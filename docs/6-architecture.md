## Architecture

### Dependency injection

We use DI container (Awilix) for decoupling. Remember to register everything you want to use in handlers inside **container.ts**.

### Feature

Every application starts with a feature. Feature is a set of functionalities bound by a single bounded context - for example invoicing.

Features are located inside ```app/features```.

### Actions/Endpoints

We are using Actions to define REST endpoints.

Actions are stored in ```actions``` directory inside coresponding feature.

### Action + Command/Query + Handler

We are not using controllers approach. Instead, each endpoint has its own action that executes specific Command/Query by Command Bus.

