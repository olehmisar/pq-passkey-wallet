# pq-passkey-wallet

**Passkey-custodied ML-DSA-44 ERC-4337 smart wallet on Ethereum Sepolia** — FIPS-204 signatures in the browser, validated on-chain via an existing ZKNox verifier, with no PQ key material on the server.

## Demo

**https://pq-wallet.vercel.app** (Sepolia testnet)

Requires a platform passkey with [WebAuthn `largeBlob`](https://w3c.github.io/webauthn/#sctn-large-blob-extension) — Safari or Chrome + iCloud Keychain on macOS. New wallets receive test ETH on create; use **Add test ETH** before send if balance is low (~0.10 ETH for first deploy+send).

## Architecture

```
Passkey (UV) → largeBlob (32-byte PQ seed)
      → noble ml_dsa44 sign UserOp hash
      → server relay handleOps only
      → EntryPoint v0.9 → PqSimpleAccount → ZKNOX_dilithium.verify
```

| Layer       | Role                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Custody** | 32-byte ML-DSA seed in passkey `largeBlob` (~2 KB limit); pubkey registered on-chain via `setKey` → SSTORE2 `pkPointer` |
| **Sign**    | Each tx: passkey unlock → read seed → `keygen` + sign in RAM → no tab-lifetime cache                                    |
| **Chain**   | Counterfactual CREATE2 deploy (`PqSimpleAccountFactory`), UserOps, ~2.4 KB signatures, ~10M verification gas            |

Sepolia contracts: EntryPoint `0x433709009B8330FDa32311DF1C2AFA402eD8D009` · verifier `0x4defe4c0014fb36c49d42e70e62af2f6c7470b06` · factory `0xee0181e17688d191a9e592589eef4d818b0f5874`

## Security

Experimental dev wallet — not production-ready. See [AUDIT.md](./AUDIT.md) for full threat model.

- **Custody:** PQ seed never leaves the authenticator except after per-tx user verification; not stored in `localStorage`.
- **Signing:** PQ signing runs only in the browser; backend relays signed UserOps, it does not hold user keys.
- **On-chain:** `userOpHash` binds chain, EntryPoint, sender, and nonce; validation is ML-DSA-44 via [ZKNOX_dilithium](https://github.com/ZKNoxHQ/ETHDILITHIUM) (upstream marks experimental / unaudited).
- **Known limits:** Plaintext seed in `largeBlob` JSON (authenticator + UV boundary); ZKNox verifier not independently audited.

---

## Details

### Crypto

|                | Off-chain                                                                         | On-chain                                                   |
| -------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Library        | [@noble/post-quantum](https://github.com/paulmillr/noble-post-quantum) `ml_dsa44` | [ZKNOX_dilithium](https://github.com/ZKNoxHQ/ETHDILITHIUM) |
| Algorithm      | FIPS-204 ML-DSA-44                                                                | Same (integrated verifier, not authored here)              |
| Signature size | 2,420 bytes                                                                       | —                                                          |

`PqSimpleAccount` replaces ECDSA `ecrecover` with `verifier.verify(pkPointer, userOpHash, signature)`. Factory layout follows [SimpleAccountFactory](https://github.com/eth-infinitism/account-abstraction/blob/develop/contracts/accounts/SimpleAccountFactory.sol).

### ERC-4337 flow (Sepolia)

1. Register pubkey → `ZKNOX_dilithium.setKey` (server-funded on testnet).
2. Fund smart-account address (counterfactual or deployed).
3. Browser builds & signs UserOp (`viem` `toPqSimpleSmartAccount`, explicit EntryPoint nonce).
4. Pre-verify signature against verifier RPC call.
5. `POST /api/handle-ops` → bundler EOA submits `handleOps`.

PQ validation is gas-heavy; test funding accounts for prefund at live base fee.

### vs MultiVM public stack

|           | This repo                      | [pq-smart-wallet](https://github.com/multivmlabs/pq-smart-wallet) |
| --------- | ------------------------------ | ----------------------------------------------------------------- |
| PQ params | ML-DSA-**44**                  | ML-DSA-**65**                                                     |
| Custody   | WebAuthn passkey + `largeBlob` | Snap / CLI / WalletConnect                                        |
| Account   | SimpleAccount-style + viem AA  | Kernel v3 + ERC-7579 module                                       |
| Verifier  | ZKNox on EVM (Sepolia)         | Stylus ML-DSA verifier                                            |

Complementary POC: passkey self-custody on existing EVM rather than native PQ L1.

### Stack & layout

| Layer     | Choice                                                                |
| --------- | --------------------------------------------------------------------- |
| UI        | React 19, Tailwind v4                                                 |
| WebAuthn  | ox (`Registration`, `Authentication`, largeBlob)                      |
| EVM       | viem, EntryPoint **v0.9**                                             |
| Contracts | Foundry — `PqSimpleAccount`, `PqSimpleAccountFactory`, ZKNox verifier |
| Toolchain | [Vite+](https://viteplus.dev/) (`vp dev` / `vp build` / `vp test`)    |

```
pq-passkey-wallet/
├── sdk/         # passkey, largeBlob, PQ keys, AA, wallet
├── src/         # React UI
├── contracts/   # Foundry
├── server/      # testnet fund / set-key / handle-ops relay
└── AUDIT.md
```

### Local dev

```bash
vp install
vp run dev          # forge:build → dev server
vp test             # vitest + forge test
```

`vp run forge:deps` installs `account-abstraction`, OpenZeppelin, and ZKNox into `contracts/lib/` (gitignored).

Env (see `.env.example`): `VITE_RPC_URL`, `VITE_ENTRY_POINT_ADDRESS`, `VITE_ML_DSA_VERIFIER`, `VITE_PQ_ACCOUNT_FACTORY`. Server relay needs `FUNDER_PRIVATE_KEY` (never in client bundle).
