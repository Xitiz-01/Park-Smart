#!/usr/bin/env python3
"""ParkSmart redesign fixtures: a disposable local stack, seed data and screenshots.

    python3 docs/redesign/tools/fixtures.py up              # local mongod + backend + frontend
    python3 docs/redesign/tools/fixtures.py seed [--reset]  # accounts, locations, EV bays, vehicles, bookings
    python3 docs/redesign/tools/fixtures.py smoke            # form login per role + every route loads
    python3 docs/redesign/tools/fixtures.py shoot --out docs/redesign/screens/phase-1
    python3 docs/redesign/tools/fixtures.py status
    python3 docs/redesign/tools/fixtures.py down

Safety rules (see README.md):
  * Only ever talks to a mongod this script started itself: loopback-only, its own data dir,
    database name starting with "parksmart-fixtures". Any other MongoDB is refused.
  * Backend and frontend run on dedicated ports (5055 / 3055 by default). Every API call and
    screenshot first checks that the process listening on that port is the one started here,
    so a backend you run yourself against a real database is never touched.
  * Passwords and secrets are generated at run time and stored outside the repo (mode 0600).
"""
import argparse, base64, contextlib, datetime as dt, http.cookiejar, json, os, re, secrets, shutil, signal, subprocess, sys, time
import urllib.error, urllib.parse, urllib.request
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
REPO = TOOLS.parents[2]
STATE = Path(os.environ.get('PARKSMART_FIXTURE_HOME', '~/.cache/parksmart-redesign-fixtures')).expanduser().resolve()
MONGO_PORT = int(os.environ.get('PARKSMART_FIXTURE_MONGO_PORT', '27029'))
API_PORT = int(os.environ.get('PARKSMART_FIXTURE_API_PORT', '5055'))
APP_PORT = int(os.environ.get('PARKSMART_FIXTURE_APP_PORT', '3055'))
DB_NAME = 'parksmart-fixtures'
LOCAL_HOSTS = {'127.0.0.1', 'localhost', '::1'}
API = f'http://localhost:{API_PORT}'
APP = f'http://localhost:{APP_PORT}'
ROLES = ['customer', 'admin', 'vendor', 'applicant']
CHROME = os.environ.get('CHROME_PATH', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
DBPATH = STATE / 'mongo-data'
LOGS = STATE / 'logs'


def die(message, code=1):
    print(f'fixtures: {message}', file=sys.stderr)
    sys.exit(code)


def email_for(role):
    return f'fixture-{role}@parksmart.test'


# ---------------------------------------------------------------- guards

def assert_state_outside_repo():
    if STATE == REPO or REPO in STATE.parents:
        die(f'PARKSMART_FIXTURE_HOME ({STATE}) must be outside the repository so credentials can never be committed.')


def assert_local_mongo(uri):
    """Refuse any MongoDB URI that is not plain mongodb:// on loopback with a fixture DB name."""
    parts = urllib.parse.urlsplit(uri)
    if parts.scheme != 'mongodb':
        die(f'refusing MongoDB URI with scheme "{parts.scheme}" (only local mongodb:// is allowed)')
    for hostport in parts.netloc.rsplit('@', 1)[-1].split(','):
        host = hostport[1:hostport.index(']')] if hostport.startswith('[') else hostport.rsplit(':', 1)[0]
        if host not in LOCAL_HOSTS:
            die(f'refusing non-local MongoDB host "{host}"')
    name = parts.path.lstrip('/')
    if not name.startswith(DB_NAME):
        die(f'refusing database "{name}" (fixture databases must start with "{DB_NAME}")')
    return name


def mongo_uri():
    uri = f'mongodb://127.0.0.1:{MONGO_PORT}/{DB_NAME}'
    assert_local_mongo(uri)
    return uri


def listening_pids(port):
    out = subprocess.run(['lsof', '-t', '-nP', f'-iTCP:{port}', '-sTCP:LISTEN'], capture_output=True, text=True).stdout
    return [int(pid) for pid in out.split()]


def load_state():
    path = STATE / 'state.json'
    return json.loads(path.read_text()) if path.exists() else {}


def save_state(state):
    (STATE / 'state.json').write_text(json.dumps(state, indent=1))


def owned_by(port, pgid):
    pids = listening_pids(port)
    if not pids or pgid is None:
        return False
    try:
        return all(os.getpgid(pid) == pgid for pid in pids)
    except ProcessLookupError:
        return False


def mongod_is_ours():
    """True only if a mongod on MONGO_PORT is serving our own data dir, loopback-only."""
    if not listening_pids(MONGO_PORT):
        return False
    js = 'const o = db.serverCmdLineOpts().parsed; print(JSON.stringify({p: o.storage.dbPath, b: o.net.bindIp}))'
    run = subprocess.run(['mongosh', '--quiet', mongo_uri(), '--eval', js], capture_output=True, text=True)
    try:
        info = json.loads(run.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        return False
    ips = [ip.strip() for ip in str(info.get('b', '')).split(',')]
    return Path(info.get('p', '')).resolve() == DBPATH.resolve() and ips and all(ip in LOCAL_HOSTS for ip in ips)


def require_stack(need_app=False):
    state = load_state()
    if not mongod_is_ours():
        die(f'no fixture mongod on :{MONGO_PORT}. Run `fixtures.py up` first.')
    if not owned_by(API_PORT, state.get('backend_pgid')):
        die(f'the process on :{API_PORT} was not started by `fixtures.py up` (or nothing is running). Refusing to call it.')
    if need_app and not owned_by(APP_PORT, state.get('frontend_pgid')):
        die(f'the process on :{APP_PORT} was not started by `fixtures.py up` (or nothing is running). Refusing to screenshot it.')
    return state


# ---------------------------------------------------------------- secrets

def runtime_secrets():
    """Generated once per state dir; never written inside the repo."""
    path = STATE / 'secrets.json'
    if path.exists():
        return json.loads(path.read_text())
    values = {
        'password': secrets.token_urlsafe(18) + 'Aa1',
        'betterAuthSecret': secrets.token_urlsafe(48),
        'addressSelectionSecret': secrets.token_urlsafe(48),
        'jwtSecret': secrets.token_urlsafe(48),
    }
    path.write_text(json.dumps(values))
    path.chmod(0o600)
    return values


# ---------------------------------------------------------------- HTTP

def api_call(opener, method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json', 'Origin': APP})
    try:
        with opener.open(req, timeout=30) as res:
            return res.status, json.loads(res.read() or b'null')
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            return error.code, json.loads(raw or b'null')
        except ValueError:
            return error.code, {'message': raw[:200].decode(errors='replace')}


def session(role):
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    status, body = api_call(opener, 'POST', '/api/auth/sign-in/email', {'email': email_for(role), 'password': runtime_secrets()['password']})
    if status != 200:
        die(f'sign-in failed for {role}: {status} {(body or {}).get("message", "")}. Has `fixtures.py seed` been run?')
    return opener, jar


def wait_for(predicate, timeout, what):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return
        time.sleep(0.5)
    die(f'timed out waiting for {what}')


def http_ok(url):
    try:
        with urllib.request.urlopen(url, timeout=3) as res:
            return res.status < 500
    except Exception:
        return False


# ---------------------------------------------------------------- commands

def cmd_up(_args):
    for tool in ('mongod', 'mongosh', 'node', 'npm', 'lsof'):
        if not shutil.which(tool):
            die(f'`{tool}` is not on PATH')
    STATE.mkdir(parents=True, exist_ok=True)
    STATE.chmod(0o700)
    LOGS.mkdir(exist_ok=True)
    DBPATH.mkdir(exist_ok=True)
    keys = runtime_secrets()
    uri = mongo_uri()
    state = load_state()

    if mongod_is_ours():
        print(f'mongod      already running on 127.0.0.1:{MONGO_PORT}')
    elif listening_pids(MONGO_PORT):
        die(f'port {MONGO_PORT} is used by another MongoDB or process. Set PARKSMART_FIXTURE_MONGO_PORT.')
    else:
        subprocess.run(['mongod', '--dbpath', str(DBPATH), '--port', str(MONGO_PORT), '--bind_ip', '127.0.0.1',
                        '--logpath', str(LOGS / 'mongod.log'), '--pidfilepath', str(STATE / 'mongod.pid'), '--fork'],
                       check=True, stdout=subprocess.DEVNULL)
        wait_for(mongod_is_ours, 30, 'mongod')
        print(f'mongod      started on 127.0.0.1:{MONGO_PORT} (data: {DBPATH})')

    if owned_by(API_PORT, state.get('backend_pgid')):
        print(f'backend     already running on :{API_PORT}')
    elif listening_pids(API_PORT):
        die(f'port {API_PORT} is used by a process not started here. Set PARKSMART_FIXTURE_API_PORT.')
    else:
        # Every key in backend/.env is overridden so dotenv (which never overrides existing
        # variables) cannot fall back to a real database, real provider keys or real secrets.
        env = dict(os.environ,
                   PORT=str(API_PORT), MONGODB_URI=uri, NODE_ENV='development',
                   CLIENT_URL=APP, BETTER_AUTH_URL=API, BETTER_AUTH_TRUSTED_ORIGINS=APP,
                   BETTER_AUTH_SECRET=keys['betterAuthSecret'], ADDRESS_SELECTION_SECRET=keys['addressSelectionSecret'],
                   JWT_SECRET=keys['jwtSecret'], JWT_EXPIRE='7d', BETTER_AUTH_CROSS_SITE_COOKIES='false',
                   BETTER_AUTH_MONGO_TRANSACTIONS='false', BETTER_AUTH_SUPER_ADMIN_USER_IDS='', BETTER_AUTH_ADMIN_USER_IDS='',
                   GEOCODING_PROVIDER='geoapify', GEOCODING_API_KEY='', API_NINJAS_API_KEY='',
                   DIGILOCKER_ENABLED='false', CASHFREE_VERIFY_ENABLED='false',
                   VERIFICATION_STORAGE_PROVIDER='local', VERIFICATION_STORAGE_LOCAL_PATH=str(STATE / 'verification-storage'))
        log_path = LOGS / 'backend.log'
        with open(log_path, 'w') as log:
            proc = subprocess.Popen(['node', 'server.js'], cwd=REPO / 'backend', env=env, stdout=log, stderr=subprocess.STDOUT,
                                    start_new_session=True)
        state['backend_pgid'] = os.getpgid(proc.pid)
        save_state(state)

        def connected():
            text = log_path.read_text()
            if 'MongoDB connection error' in text or proc.poll() is not None:
                die(f'backend failed to start; see {log_path}')
            return 'MongoDB Connected:' in text
        wait_for(connected, 60, 'backend database connection')
        host = re.search(r'MongoDB Connected: (\S+)', log_path.read_text()).group(1)
        if host not in LOCAL_HOSTS:
            os.killpg(state['backend_pgid'], signal.SIGTERM)
            die(f'backend reported a non-local MongoDB host "{host}"; stopped it.')
        wait_for(lambda: http_ok(f'{API}/api'), 30, 'backend HTTP')
        print(f'backend     started on {API} (MongoDB {host}, providers off)')

    if owned_by(APP_PORT, state.get('frontend_pgid')):
        print(f'frontend    already running on {APP}')
    elif listening_pids(APP_PORT):
        die(f'port {APP_PORT} is used by a process not started here. Set PARKSMART_FIXTURE_APP_PORT.')
    else:
        frontend = REPO / 'frontend'
        uses_vite = any(frontend.glob('vite.config.*'))
        cmd = ['npx', 'vite', '--port', str(APP_PORT), '--strictPort', '--host', 'localhost'] if uses_vite else ['npm', 'start']
        # Shell variables take precedence over frontend/.env for both CRA and Vite.
        env = dict(os.environ, PORT=str(APP_PORT), BROWSER='none',
                   REACT_APP_API_URL=f'{API}/api', REACT_APP_AUTH_URL=API, VITE_API_URL=f'{API}/api', VITE_AUTH_URL=API,
                   DEV_PROXY_TARGET=API)
        with open(LOGS / 'frontend.log', 'w') as log:
            proc = subprocess.Popen(cmd, cwd=frontend, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        state['frontend_pgid'] = os.getpgid(proc.pid)
        save_state(state)
        wait_for(lambda: http_ok(APP), 240, 'frontend dev server')
        print(f'frontend    started on {APP} ({"vite" if uses_vite else "react-scripts"})')
    print(f'state dir   {STATE}')


def mongosh_eval(js):
    run = subprocess.run(['mongosh', '--quiet', mongo_uri(), '--eval', js], capture_output=True, text=True)
    if run.returncode:
        die(f'mongosh failed: {run.stdout.strip()} {run.stderr.strip()}')
    return run.stdout.strip()


def cmd_seed(args):
    require_stack()
    if args.reset:
        mongosh_eval(f'if (db.getName() !== "{DB_NAME}") quit(2); db.dropDatabase(); print("dropped")')
        print(f'reset       dropped {DB_NAME}')
    elif int(mongosh_eval('print(db.users.countDocuments())') or 0):
        die('fixture database already has users. Use `seed --reset` to start over.')

    password = runtime_secrets()['password']
    opener = urllib.request.build_opener()
    for role in ROLES:
        status, body = api_call(opener, 'POST', '/api/auth/sign-up/email',
                                {'name': f'Fixture {role.title()}', 'email': email_for(role), 'phone': '9876543210', 'password': password})
        if status != 200:
            die(f'sign-up failed for {role}: {status} {(body or {}).get("message", "")}')
    print(f'accounts    {", ".join(email_for(role) for role in ROLES)}')

    env = dict(os.environ, PARKSMART_FIXTURE_DB=DB_NAME, PARKSMART_FIXTURE_DBPATH=str(DBPATH.resolve()))
    run = subprocess.run(['mongosh', '--quiet', mongo_uri(), str(TOOLS / 'seed.mongosh.js')], capture_output=True, text=True, env=env)
    if run.returncode:
        die(f'seed refused or failed: {run.stdout.strip()} {run.stderr.strip()}')
    ids = json.loads(run.stdout.strip().splitlines()[-1])
    print('domain      3 locations (1 draft), 6 EV bays (EV04 maintenance), 2 vehicles, pending applicant')

    customer, _ = session('customer')
    loc, start = ids['evLocationId'], dt.datetime.now(dt.timezone.utc).replace(microsecond=0) + dt.timedelta(hours=2)
    iso = lambda value: value.isoformat().replace('+00:00', 'Z')
    query = urllib.parse.urlencode({'vehicleType': 'car', 'fuelType': 'electric', 'startTime': iso(start), 'endTime': iso(start + dt.timedelta(hours=3))})
    status, detail = api_call(customer, 'GET', f'/api/parking-locations/{loc}?{query}')
    free = [slot for slot in (detail or {}).get('location', {}).get('availability', {}).get('evSlots', []) if slot.get('available')]
    if status != 200 or not free:
        die(f'could not read EV availability ({status})')
    plans = [
        {'parkingLocationId': loc, 'bookingType': 'regular', 'vehicleId': ids['petrolVehicleId'], 'startTime': iso(start), 'expectedEndTime': iso(start + dt.timedelta(hours=2))},
        {'parkingLocationId': loc, 'bookingType': 'ev', 'slotId': free[0]['_id'], 'vehicleId': ids['evVehicleId'], 'startTime': iso(start), 'expectedEndTime': iso(start + dt.timedelta(hours=3))},
        {'parkingLocationId': loc, 'bookingType': 'regular', 'vehicleId': ids['petrolVehicleId'], 'startTime': iso(start + dt.timedelta(days=1)), 'expectedEndTime': iso(start + dt.timedelta(days=1, hours=1))},
    ]
    made = []
    for plan in plans:
        status, body = api_call(customer, 'POST', '/api/bookings', plan)
        if status not in (200, 201):
            die(f'booking failed: {status} {(body or {}).get("message", "")}')
        made.append(body['booking'])
    api_call(customer, 'PUT', f'/api/bookings/{made[-1]["_id"]}/cancel')
    ids['bookings'] = [booking['bookingCode'] for booking in made]
    ids['seededAt'] = iso(dt.datetime.now(dt.timezone.utc))
    (STATE / 'fixtures.json').write_text(json.dumps(ids, indent=1))
    print(f'bookings    {", ".join(ids["bookings"])} (regular, EV, cancelled), made through the real API')
    print(f'password    stored in {STATE / "secrets.json"} (mode 0600); not printed')


def routes(ids):
    start = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=2)).replace(minute=0, second=0, microsecond=0)
    window = urllib.parse.urlencode({'startTime': start.isoformat().replace('+00:00', 'Z'),
                                     'endTime': (start + dt.timedelta(hours=2)).isoformat().replace('+00:00', 'Z')})
    loc = ids['evLocationId']
    return [
        (None, 'landing', '/'), (None, 'login', '/login'), (None, 'register', '/register'),
        ('customer', 'customer-dashboard', '/dashboard'),
        ('customer', 'customer-find-parking', '/dashboard/nearby'),
        ('customer', 'customer-booking-regular', f'/dashboard/parking/{loc}?{window}&vehicleType=car&fuelType=petrol&vehicleId={ids["petrolVehicleId"]}&distanceKm=0.4'),
        ('customer', 'customer-booking-ev', f'/dashboard/parking/{loc}?{window}&vehicleType=car&fuelType=electric&vehicleId={ids["evVehicleId"]}&distanceKm=0.4'),
        ('customer', 'customer-my-bookings', '/dashboard/bookings'),
        ('customer', 'customer-vehicles', '/dashboard/vehicles'),
        ('customer', 'customer-profile', '/dashboard/profile'),
        ('customer', 'vendor-apply', '/vendor/apply'),
        ('applicant', 'vendor-status-pending', '/vendor/status'),
        ('vendor', 'vendor-dashboard', '/vendor'),
        ('vendor', 'vendor-locations', '/vendor/locations'),
        ('vendor', 'vendor-location-new', '/vendor/locations/new'),
        ('vendor', 'vendor-location-edit', f'/vendor/locations/{loc}/edit'),
        ('vendor', 'vendor-slots', '/vendor/slots'),
        ('vendor', 'vendor-bookings', '/vendor/bookings'),
        ('vendor', 'vendor-profile', '/vendor/profile'),
        ('vendor', 'vendor-verification', '/vendor/verification'),
        ('vendor', 'vendor-transactions', '/vendor/transactions'),
        ('vendor', 'vendor-earnings', '/vendor/earnings'),
        ('vendor', 'vendor-settings', '/vendor/settings'),
        ('admin', 'admin-dashboard', '/admin'),
        ('admin', 'admin-slots', '/admin/slots'),
        ('admin', 'admin-bookings', '/admin/bookings'),
        ('admin', 'admin-users', '/admin/users'),
        ('admin', 'admin-vendors', '/admin/vendors'),
        ('admin', 'admin-verifications', '/admin/verifications'),
    ]


@contextlib.contextmanager
def headless_chrome():
    """Yields (cdp, js, events) for one headless Chrome page with geolocation pinned to FC Road."""
    try:
        import websocket  # websocket-client
    except ImportError:
        die('this command needs the Python package websocket-client (pip install websocket-client)')
    profile = STATE / 'chrome-profile'
    shutil.rmtree(profile, ignore_errors=True)
    debug_port = int(os.environ.get('PARKSMART_FIXTURE_CDP_PORT', '9333'))
    chrome = subprocess.Popen([CHROME, '--headless=new', f'--remote-debugging-port={debug_port}', f'--user-data-dir={profile}',
                               '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        targets = None
        for _ in range(100):
            try:
                targets = json.load(urllib.request.urlopen(f'http://127.0.0.1:{debug_port}/json', timeout=2)); break
            except Exception:
                time.sleep(0.2)
        if not targets:
            die('headless Chrome did not start')
        page = next(t for t in targets if t['type'] == 'page')
        ws = websocket.create_connection(page['webSocketDebuggerUrl'], suppress_origin=True, max_size=None)
        counter, events = [0], []

        def cdp(method, **params):
            counter[0] += 1
            ws.send(json.dumps({'id': counter[0], 'method': method, 'params': params}))
            while True:
                msg = json.loads(ws.recv())
                if msg.get('id') == counter[0]:
                    if 'error' in msg:
                        raise RuntimeError(f'{method}: {msg["error"]}')
                    return msg.get('result', {})
                events.append(msg)

        def js(expr):
            return cdp('Runtime.evaluate', expression=expr, returnByValue=True, awaitPromise=True).get('result', {}).get('value')

        for domain in ('Page', 'Runtime', 'Log', 'Network'):
            cdp(f'{domain}.enable')
        cdp('Browser.grantPermissions', origin=APP, permissions=['geolocation'])
        cdp('Emulation.setGeolocationOverride', latitude=18.5236, longitude=73.8410, accuracy=30)
        yield cdp, js, events
        ws.close()
    finally:
        chrome.terminate()
        shutil.rmtree(profile, ignore_errors=True)


def cookie_login(cdp, role):
    """Signs in through the API and hands the session cookies to Chrome (None = signed out)."""
    cdp('Network.clearBrowserCookies')
    if role:
        _, jar = session(role)
        for c in jar:
            cdp('Network.setCookie', name=c.name, value=c.value, domain='localhost', path=c.path or '/', httpOnly=True)


def console_errors(events):
    errors = [e['params']['entry']['text'][:200] for e in events
              if e.get('method') == 'Log.entryAdded' and e['params']['entry']['level'] == 'error']
    errors += [' '.join(str(a.get('value', a.get('description', '')))[:200] for a in e['params']['args']) for e in events
               if e.get('method') == 'Runtime.consoleAPICalled' and e['params']['type'] in ('error', 'warning')]
    return sorted(set(errors))


# Console errors already present in the Phase 0 baseline, so they don't fail the smoke run.
KNOWN_ERRORS = {
    # AUDIT.md 5.U: the editor fires an address lookup on mount; with Geoapify off it returns 503.
    'vendor-location-edit': 'status of 503',
}


def cmd_smoke(args):
    """Signs in through the real login form for each role, then loads every route once."""
    require_stack(need_app=True)
    fixtures_path = STATE / 'fixtures.json'
    if not fixtures_path.exists():
        die('no fixtures yet. Run `fixtures.py seed` first.')
    ids = json.loads(fixtures_path.read_text())
    expected_home = {'customer': '/dashboard', 'admin': '/admin', 'vendor': '/vendor', 'applicant': '/vendor/status'}
    failures = []
    with headless_chrome() as (cdp, js, events):
        cdp('Emulation.setDeviceMetricsOverride', width=1280, height=900, deviceScaleFactor=1, mobile=False)
        for role, home in expected_home.items():
            cdp('Network.clearBrowserCookies')
            cdp('Page.navigate', url=APP + '/login'); time.sleep(args.settle)
            # Typed through CDP so React sees real input events; the password never reaches stdout.
            for field, value in (('email', email_for(role)), ('password', runtime_secrets()['password'])):
                js(f'document.getElementById({json.dumps(field)}).focus()')
                cdp('Input.insertText', text=value)
            js("document.querySelector('form button[type=submit]').click()")
            deadline = time.time() + 15
            while time.time() < deadline and js('location.pathname') == '/login':
                time.sleep(0.3)
            time.sleep(1)
            final = js('location.pathname')
            ok = final == home
            failures += [] if ok else [f'login {role}: ended on {final}, expected {home}']
            print(f'{"ok  " if ok else "FAIL"} form login as {role:<9} → {final}', flush=True)
        current = 'unset'
        for role, name, path in routes(ids):
            if role != current:
                cookie_login(cdp, role); current = role
            events.clear()
            cdp('Page.navigate', url=APP + path); time.sleep(args.settle)
            final = js('location.pathname') or ''
            rendered = js("document.getElementById('root')?.childElementCount || 0")
            errors = console_errors(events)
            expected = path.split('?')[0]
            known = KNOWN_ERRORS.get(name)
            errors = [e for e in errors if not (known and known in e)]
            ok = rendered and final == expected and not errors
            if not ok:
                failures.append(f'{name}: path {final} (expected {expected}), rendered={bool(rendered)}, errors={errors}')
            print(f'{"ok  " if ok else "FAIL"} {name:<26} {final}{"  " + "; ".join(errors) if errors else ""}', flush=True)
    print(f'\n{len(failures)} failure(s)' if failures else '\nall checks passed')
    if failures:
        sys.exit(1)


def cmd_shoot(args):
    require_stack(need_app=True)
    fixtures_path = STATE / 'fixtures.json'
    if not fixtures_path.exists():
        die('no fixtures yet. Run `fixtures.py seed` first.')
    ids = json.loads(fixtures_path.read_text())
    out = (REPO / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    widths = [int(w) for w in args.widths.split(',')]
    heights = {1440: 900, 1024: 768, 768: 1024, 390: 844, 320: 640}
    only = set(args.only.split(',')) if args.only else None
    selected = [r for r in routes(ids) if not only or r[1] in only]

    with headless_chrome() as (cdp, js, events):
        def login(role):
            cookie_login(cdp, role)

        def capture(name, width):
            shot = cdp('Page.captureScreenshot', format='png')
            (out / f'{name}-{width}.png').write_bytes(base64.b64decode(shot['data']))

        report, current = [], 'unset'
        for role, name, path in selected:
            if role != current:
                login(role); current = role
            for width in widths:
                height = heights.get(width, 900)
                cdp('Emulation.setDeviceMetricsOverride', width=width, height=height, deviceScaleFactor=1, mobile=width < 768)
                events.clear()
                cdp('Page.navigate', url=APP + path)
                time.sleep(args.settle)
                final = js('location.pathname') or ''
                overflow = js('Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth')
                full = js('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)') or height
                errors = console_errors(events)
                cdp('Emulation.setDeviceMetricsOverride', width=width, height=min(int(full), 7000), deviceScaleFactor=1, mobile=width < 768)
                time.sleep(0.6)
                capture(name, width)
                report.append({'name': name, 'route': path.split('?')[0], 'width': width, 'finalPath': final,
                               'horizontalOverflowPx': overflow, 'pageHeight': full, 'consoleErrors': errors})
                flag = f' OVERFLOW {overflow}px' if overflow else ''
                print(f'{name}-{width}.png{flag}{" errors " + str(len(errors)) if errors else ""}', flush=True)

        if not args.no_reduced_motion:
            login('customer')
            cdp('Emulation.setEmulatedMedia', features=[{'name': 'prefers-reduced-motion', 'value': 'reduce'}])
            cdp('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=1, mobile=True)
            cdp('Page.navigate', url=APP + '/dashboard'); time.sleep(args.settle)
            drawer = js("(() => { const el = document.querySelector('.ps-sidebar-mobile, [data-mobile-nav]'); if (!el) return null;"
                        " const r = el.getBoundingClientRect(); return {left: r.left, right: r.right, transform: getComputedStyle(el).transform}; })()")
            capture('extra-reduced-motion-customer-dashboard', 390)
            report.append({'name': 'extra-reduced-motion-customer-dashboard', 'width': 390, 'mobileNavRect': drawer})
            print(f'reduced-motion mobile nav rect: {drawer}')

        (out / 'report.json').write_text(json.dumps(report, indent=1))
        overflowing = [f'{r["name"]}@{r["width"]}' for r in report if r.get('horizontalOverflowPx')]
        print(f'{len(report)} captures → {out}. Overflow: {", ".join(overflowing) or "none"}')


def cmd_status(_args):
    state = load_state()
    print(f'state dir   {STATE}')
    print(f'mongod      {"ours on :" + str(MONGO_PORT) if mongod_is_ours() else "not running (or not ours)"}')
    print(f'backend     {"ours on " + API if owned_by(API_PORT, state.get("backend_pgid")) else "not running (or not ours)"}')
    print(f'frontend    {"ours on " + APP if owned_by(APP_PORT, state.get("frontend_pgid")) else "not running (or not ours)"}')
    fixtures = STATE / 'fixtures.json'
    print(f'fixtures    {"seeded " + json.loads(fixtures.read_text()).get("seededAt", "") if fixtures.exists() else "not seeded"}')
    print(f'accounts    {", ".join(email_for(role) for role in ROLES)} (password in secrets.json, mode 0600)')


def cmd_down(_args):
    state = load_state()
    for key, port in (('frontend_pgid', APP_PORT), ('backend_pgid', API_PORT)):
        pgid = state.get(key)
        if pgid and owned_by(port, pgid):
            os.killpg(pgid, signal.SIGTERM)
            print(f'stopped     {key.split("_")[0]}')
        state.pop(key, None)
    if STATE.exists():
        save_state(state)
    if mongod_is_ours():
        subprocess.run(['mongosh', '--quiet', mongo_uri(), '--eval', 'db.getSiblingDB("admin").shutdownServer()'],
                       capture_output=True, text=True)
        print('stopped     mongod (data kept; `up` + `seed --reset` to rebuild)')


def main():
    assert_state_outside_repo()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('up', help='start the disposable local stack').set_defaults(fn=cmd_up)
    seed = sub.add_parser('seed', help='create fixture accounts and data')
    seed.add_argument('--reset', action='store_true', help='drop the fixture database first')
    seed.set_defaults(fn=cmd_seed)
    shoot = sub.add_parser('shoot', help='capture full-page screenshots of every route')
    shoot.add_argument('--out', required=True, help='output dir, e.g. docs/redesign/screens/phase-1')
    shoot.add_argument('--widths', default='1440,1024,768,390', help='comma-separated widths (add 320 for overflow checks)')
    shoot.add_argument('--only', help='comma-separated route names to capture (see routes() in this file)')
    shoot.add_argument('--settle', type=float, default=3.2, help='seconds to wait after navigation')
    shoot.add_argument('--no-reduced-motion', action='store_true', help='skip the reduced-motion mobile capture')
    shoot.set_defaults(fn=cmd_shoot)
    smoke = sub.add_parser('smoke', help='log in through the form as each role, then load every route')
    smoke.add_argument('--settle', type=float, default=2.5, help='seconds to wait after navigation')
    smoke.set_defaults(fn=cmd_smoke)
    sub.add_parser('status').set_defaults(fn=cmd_status)
    sub.add_parser('down', help='stop everything started by `up`').set_defaults(fn=cmd_down)
    args = parser.parse_args()
    args.fn(args)


if __name__ == '__main__':
    main()
