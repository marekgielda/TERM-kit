## Adding new feature

A simples way to add a new feature is to run a specific set of plop generators.

First we need to create directory structure.

```
npm run plop

select feature

give it a name

submit
```

This will create a set of directories for your feature.

After that we can add actions inside the feature using plop commands:

```
npm run plop

for POST/PATCH/PUT/DELETE endpoint select: action+command+handler
for GET/HEAD endpoint select: action+query+handler

follow instructions

and submit
```