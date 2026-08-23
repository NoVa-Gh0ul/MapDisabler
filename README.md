# Behavior Pack Template
Helpful template repository for building [Behavior Packs](https://wiki.bedrock.dev/scripting/scripting-intro) in TypeScript.

## Setup
1. Clone this repository 
2. Run `npm install`

You now have great intellisense to make development quick and easy!

## Usage/Tools
The structure of this project follows the [TypeScript scripting tutorial](https://wiki.bedrock.dev/scripting/typescript) with some additional tools to make your coding environment less annoying
- `npm run build` will compile your TypeScript code inside `src/`, output to `scripts/` and create a `.mcpack` file in the root of this project.

The .mcpack created from this template looks like:
```
- Template_Behavior_Pack_v1.0.0
  - scripts
    - main.js
  - manifest.json
  - pack_icon.png
```

- `npm run pack` will create a `.mcpack` file in the root of this project.

## Roadmap
- [ ] Auto `/reload` script for development on worlds
- [ ] Auto update version/uuid in `build` script
- [ ] webpack/esbuild stuff?
- [ ] Workflows to run tests and bump version?