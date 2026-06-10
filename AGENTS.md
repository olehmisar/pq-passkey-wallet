<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## pq-passkey-wallet

- **SDK** lives in `sdk/` — import via `package.json` `imports` (`#sdk`, `#sdk/*`). Do not add `resolve.alias` in `vite.config.ts`.
- **Package manager**: `pnpm` via `vp install` / `vp add` / `vp remove` (`packageManager: pnpm@11.5.2`). Config lives in `pnpm-workspace.yaml` (v11). Do not use `npm install` directly.
- **Toolchain**: use `vp run dev` / `vp run app:dev` (not raw `vite`). Tasks `app:dev` and `app:build` depend on `forge:build`, which also exports viem ABIs to `sdk/contracts/generated/` (gitignored).
- **largeBlob** is mandatory for wallet creation (ox WebAuthn + macOS Passwords).
- **On-chain PQ**: `ZKNOX_dilithium` (FIPS-204 ML-DSA-44) vendored under `contracts/lib/ETHDILITHIUM` (`vp run forge:deps` — `forge install --no-git`, not git submodules). Foundry remapping: `zknox/`.
- **Account abstraction**: `PqSimpleAccount` + `PqSimpleAccountFactory` mirror eth-infinitism `SimpleAccountFactory`; JS glue uses viem `toSmartAccount` / `createBundlerClient` (`sdk/services/aa/`).
- **Env** (optional): `VITE_RPC_URL`, `VITE_BUNDLER_URL`, `VITE_ENTRY_POINT_ADDRESS`, `VITE_ML_DSA_VERIFIER`, `VITE_PQ_ACCOUNT_FACTORY`.
- **SDK wiring**: `createSdk()` in `sdk/index.ts` uses `MlDsaPqKeyService` (`@noble/post-quantum` `ml_dsa44`). Default export: `sdk`.
- **PQ deps**: `@noble/post-quantum` (sign/verify), `@noble/hashes` (SHAKE for pubkey deployment encoding in `mlDsaDeployment.ts`).
