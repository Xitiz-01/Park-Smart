import { render } from '@testing-library/react';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogTrigger } from './alert-dialog';
import { Button } from './button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

// React 18 drops `ref` on plain function components. Radix needs refs on asChild
// triggers and on portal children, so every overlay is rendered open here with
// a Button trigger; any "cannot be given refs" warning fails the test.

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});

const overlays = {
  Dialog: () => <Dialog open><DialogTrigger asChild><Button>Open</Button></DialogTrigger><DialogContent><DialogTitle>T</DialogTitle></DialogContent></Dialog>,
  AlertDialog: () => <AlertDialog open><AlertDialogTrigger asChild><Button>Open</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogTitle>T</AlertDialogTitle></AlertDialogContent></AlertDialog>,
  Sheet: () => <Sheet open><SheetTrigger asChild><Button>Open</Button></SheetTrigger><SheetContent><SheetTitle>T</SheetTitle></SheetContent></Sheet>,
  Popover: () => <Popover open><PopoverTrigger asChild><Button>Open</Button></PopoverTrigger><PopoverContent>Body</PopoverContent></Popover>,
  Tooltip: () => <TooltipProvider><Tooltip open><TooltipTrigger asChild><Button>Open</Button></TooltipTrigger><TooltipContent>Tip</TooltipContent></Tooltip></TooltipProvider>,
  DropdownMenu: () => <DropdownMenu open><DropdownMenuTrigger asChild><Button>Open</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>Item</DropdownMenuItem></DropdownMenuContent></DropdownMenu>,
};

test.each(Object.entries(overlays))('%s passes refs through', (_name, Overlay) => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<Overlay />);
  const refWarnings = error.mock.calls.filter((args) => String(args[0]).includes('cannot be given refs'));
  error.mockRestore();
  expect(refWarnings).toEqual([]);
});
