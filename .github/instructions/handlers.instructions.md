---
applyTo: "**/*.handler.ts"
---

# Command and Query Handlers Instructions

## Overview
Handlers contain the business logic of your application following CQRS (Command Query Responsibility Segregation) pattern. They are divided into two types:
- **Command Handlers**: Handle state-changing operations (POST, PUT, DELETE)
- **Query Handlers**: Handle data retrieval operations (GET)

**CRITICAL REQUIREMENTS**:
- **ALL handlers are tested through REST API integration tests** (not unit tests)
- Handlers contain business logic, while actions handle HTTP concerns
- Never use Command Bus or Query Bus directly in handlers
- Always use dependency injection pattern

## Command Handlers

Command handlers process state-changing operations and follow this pattern:

### Command Handler Structure
```typescript
import { CommandHandler } from "@tshio/command-bus";
import { Logger } from "@tshio/logger";
import { Repository } from "typeorm";
import { CREATE_USER_COMMAND_TYPE, CreateUserCommand } from "../commands/create-user.command";
import { UserEntity } from "../models/user.entity";

export interface CreateUserHandlerDependencies {
  logger: Logger;
  userRepository: Repository<UserEntity>;
}

export default class CreateUserHandler implements CommandHandler<CreateUserCommand> {
  public commandType: string = CREATE_USER_COMMAND_TYPE;

  constructor(private dependencies: CreateUserHandlerDependencies) {}

  async execute(command: CreateUserCommand) {
    this.dependencies.logger.info("Command CreateUser executed");

    const { name, email } = command.payload;

    // Business logic and validation
    const existingUser = await this.dependencies.userRepository.findOneBy({ email });
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Create and save entity
    const userEntity = this.dependencies.userRepository.create({
      name,
      email,
    });

    const savedUser = await this.dependencies.userRepository.save(userEntity);

    return {
      result: savedUser,
    };
  }
}
```

### Command Handler Guidelines
- Always implement `CommandHandler<TCommand>` interface
- Include `commandType` property matching the command type
- Use constructor dependency injection with dependencies interface
- Include logger in dependencies for operation tracking
- Inject repositories, not data sources directly
- Contain business logic and validation rules
- Return result in `{ result: T }` format
- Throw errors for business rule violations

## Query Handlers

Query handlers process data retrieval operations and follow this pattern:

### Query Handler Structure
```typescript
import { Like, Repository } from "typeorm";
import { QueryHandler } from "@tshio/query-bus";
import { CacheQuery } from "../../../../shared/cache-decorator";
import { USERS_QUERY_TYPE, UsersQuery, UsersQueryResult } from "../queries/users.query";
import { UserEntity } from "../models/user.entity";
import { createFindManyOptions, makePaginationResult } from "../../../../shared/pagination-utils/pagination-utils";

export interface UsersQueryHandlerDependencies {
  userRepository: Repository<UserEntity>;
}

export default class UsersQueryHandler implements QueryHandler<UsersQuery, UsersQueryResult> {
  public queryType: string = USERS_QUERY_TYPE;

  constructor(private dependencies: UsersQueryHandlerDependencies) {}

  @CacheQuery({ duration: 300 }) // Cache for 5 minutes
  async execute(query: UsersQuery): Promise<UsersQueryResult> {
    const { payload } = query;
    
    // Use pagination utilities
    const findOptions = createFindManyOptions(this.dependencies.userRepository, payload);

    // Add search functionality
    if (payload.search) {
      findOptions.where = { 
        ...findOptions.where, 
        email: Like(`%${payload.search}%`) 
      };
    }

    const [data, total] = await this.dependencies.userRepository.findAndCount(findOptions);

    return new UsersQueryResult(
      makePaginationResult(data, total, findOptions, payload.search)
    );
  }
}
```

### Query Handler Guidelines
- Always implement `QueryHandler<TQuery, TResult>` interface
- Include `queryType` property matching the query type
- Use constructor dependency injection with dependencies interface
- Use `@CacheQuery` decorator for cacheable queries
- Leverage `createFindManyOptions` and `makePaginationResult` for list queries
- Return structured result using result classes
- Never modify state in query handlers

## Dependency Injection Pattern

### Dependencies Interface
Always define a dependencies interface for type safety:

```typescript
export interface CreateUserHandlerDependencies {
  logger: Logger;                           // Always required for commands
  userRepository: Repository<UserEntity>;   // Repository injection
  emailService?: EmailService;              // Optional services
}
```

## Error Handling

### Built-in Error Classes
Use error classes from `src/shared/errors` for consistent error handling:

```typescript
import { NotFoundError } from "../../../../shared/errors/not-found.error";
import { HttpError } from "../../../../shared/errors/http.error";

// In command handler
async execute(command: UpdateUserCommand) {
  const user = await this.dependencies.userRepository.findOneBy({ 
    id: command.payload.id 
  });
  
  if (!user) {
    throw new NotFoundError("User not found");
  }
  
  // Business logic validation
  if (user.status === 'deleted') {
    throw new HttpError("Cannot update deleted user", 400);
  }
  
  // Continue with update logic...
}
```

### Error Guidelines
- Throw errors as exceptions, not return them as responses
- Use `NotFoundError` for 404 errors
- Use `HttpError` for custom HTTP errors with specific status codes
- Never use `AppError` in handlers (reserved for internal errors)
- Validation errors are handled by `celebrate` middleware
- Create custom error classes extending `AppError` if needed

## Advanced Patterns

### Business Logic Organization
Structure complex business operations clearly:

```typescript
async execute(command: CreateOrderCommand) {
  this.dependencies.logger.info("Creating order", { userId: command.payload.userId });

  // 1. Validation
  await this.validateOrderCreation(command.payload);
  
  // 2. Business logic
  const order = await this.createOrderEntity(command.payload);
  
  // 3. Side effects
  await this.processOrderSideEffects(order);
  
  return { result: order };
}

private async validateOrderCreation(payload: CreateOrderPayload) {
  const user = await this.dependencies.userRepository.findOneBy({ id: payload.userId });
  if (!user) {
    throw new NotFoundError("User not found");
  }
}
```

### Repository Operations
Use TypeORM repository methods effectively:

```typescript
// Create operations
const entity = this.dependencies.userRepository.create(payload);
const savedEntity = await this.dependencies.userRepository.save(entity);

// Update operations
await this.dependencies.userRepository.update(
  { id: command.payload.id },
  { name: command.payload.name }
);

// Delete operations (soft delete preferred)
await this.dependencies.userRepository.update(
  { id: command.payload.id },
  { deletedAt: new Date() }
);

// Find operations with relations
const user = await this.dependencies.userRepository.findOne({
  where: { id: payload.id },
  relations: ['profile', 'orders']
});
```

### Query Optimization
Optimize database queries in query handlers:

```typescript
async execute(query: GetUserDetailsQuery) {
  // Select only needed fields
  const user = await this.dependencies.userRepository
    .createQueryBuilder('user')
    .select(['user.id', 'user.name', 'user.email'])
    .leftJoinAndSelect('user.profile', 'profile')
    .where('user.id = :id', { id: query.payload.id })
    .getOne();

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return { result: user };
}
```

## Testing Strategy

### Integration Testing
Handlers are tested through REST API integration tests, not unit tests:

```typescript
// Test handlers indirectly through actions
describe("POST /api/users", () => {
  it("should create user successfully", async () => {
    // This tests CreateUserHandler through CreateUserAction
    const response = await request(app)
      .post("/api/users")
      .send({ name: "John Doe", email: "john@example.com" })
      .expect(201);
    
    expect(response.body).to.have.property("id");
  });
});
```

### Why No Unit Tests for Handlers
- Handlers contain business logic that should be tested in realistic scenarios
- Integration tests provide better coverage of actual application behavior
- Database interactions are better tested with real database connections
- Mocking repositories often creates tests that don't reflect real issues

## Container Registration

Register handlers in the appropriate container files:

### Command Handlers
```typescript
// src/container/command-handlers.ts
import CreateUserHandler from "../app/features/users/handlers/create-user.handler";

export const registerCommandHandlers = (): NameAndRegistrationPair<any>[] => [
  // ... other handlers
  asClass(CreateUserHandler),
];
```

### Query Handlers  
```typescript
// src/container/query-handlers.ts
import UsersQueryHandler from "../app/features/users/query-handlers/users.query.handler";

export const registerQueryHandlers = (): NameAndRegistrationPair<any>[] => [
  // ... other handlers
  asClass(UsersQueryHandler),
];
```

## Best Practices

### Command Handlers
- Always include logger in dependencies for operation tracking
- Implement comprehensive business logic validation
- Use transactions for multi-entity operations
- Return meaningful results for actions to use
- Keep handlers focused on single responsibility

### Query Handlers
- Use `@CacheQuery` decorator for expensive or frequently accessed queries
- Leverage pagination utilities for list queries
- Optimize database queries for performance
- Structure complex queries using QueryBuilder
- Return structured results using result classes

### General Guidelines
- All handlers must have `.handler.ts` suffix
- Use dependency injection with typed interfaces
- Inject repositories, not data sources directly
- Throw errors for business rule violations
- Add comprehensive logging for debugging
- Follow CQRS principles strictly (commands change state, queries don't)