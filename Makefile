# Shortcuts for the local Docker Compose stack. `make help` lists them.
# Without make, run the docker compose commands shown here directly.
COMPOSE ?= docker compose

.DEFAULT_GOAL := help
.PHONY: help env up up-prod down logs ps seed reset-db test tools clean

help: ## List the targets
	@grep -hE '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

env: ## Create .env from .env.example if it doesn't exist
	@test -f .env || (cp .env.example .env && echo "created .env from .env.example")

up: env ## Build and start the stack (dev images, hot reload) and wait until healthy
	$(COMPOSE) up --build --detach --wait

up-prod: env ## Start the stack with the production images (no override)
	$(COMPOSE) -f docker-compose.yml up --build --detach --wait

down: ## Stop the stack (data volumes are kept)
	$(COMPOSE) down

logs: ## Follow the API and worker logs
	$(COMPOSE) logs --follow api worker

ps: ## Show service status
	$(COMPOSE) ps

seed: ## Seed the local database (fails if it already has users)
	$(COMPOSE) run --rm seed node scripts/seed.js

reset-db: ## Drop the local database and seed it again
	$(COMPOSE) run --rm seed node scripts/seed.js --reset

test: ## Run the backend tests in a container against the stack's MongoDB
	$(COMPOSE) run --rm --no-deps -e NODE_ENV=test -e TEST_MONGODB_URI=mongodb://mongo:27017 api npm test

tools: env ## Start mongo-express (8081) and Redis Insight (5540) as well
	$(COMPOSE) --profile tools up --detach --wait

clean: ## Stop the stack and delete its volumes (all local data)
	$(COMPOSE) --profile tools down --volumes
