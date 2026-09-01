# Configuração do repositório

## Verificação do Lote 1

- Data da verificação: 2026-08-26
- Branch ativa: `feature/mbj-mvp-core`
- Working tree antes da implementação: limpa
- Remote público: `https://github.com/Paulors-scrummaster/meia-boca-juniors.git`
- Branch remota acompanhada: `origin/feature/mbj-mvp-core`

O repositório remoto foi criado com um README neutro em `main`. A branch de feature preservou o
histórico local e incorporou o bootstrap remoto por um merge sem fast-forward de históricos não
relacionados, registrado no commit `86119bf` (`chore: merge GitHub bootstrap main`).

O grafo verificado antes da implementação foi:

```text
*   86119bf (feature/mbj-mvp-core) chore: merge GitHub bootstrap main
|\
| * 1e65461 (origin/main) Initial commit
* 9ae3b1a chore: protect local and sensitive files
* 7216180 (tag: checkpoint/pre-implementation) docs: split implementation and production activation
```

O código permanece somente na branch `feature/mbj-mvp-core`. Nenhum merge em `main` ou ação de
produção faz parte deste lote.

## Evidências do Lote 2 — Foundation

- Data da verificação: 2026-08-26
- Branch publicada: `feature/mbj-mvp-core`
- Commit de implementação: `9e0a8b1` (`feat: complete MBJ client foundation`)
- Pull Request draft: [#183](https://github.com/Paulors-scrummaster/meia-boca-juniors/pull/183), de
  `feature/mbj-mvp-core` para `main`
- CI do push: [execução 33028899898](https://github.com/Paulors-scrummaster/meia-boca-juniors/actions/runs/33028899898), concluída com sucesso
- CI do Pull Request: [execução 33028936945](https://github.com/Paulors-scrummaster/meia-boca-juniors/actions/runs/33028936945), concluída com sucesso
- Auto-revisão assistida pelo Codex: [comentário no PR](https://github.com/Paulors-scrummaster/meia-boca-juniors/pull/183#issuecomment-5433026348), sem achados bloqueantes
- Ruleset ativo: `Protect main`, ID `21612053`, aplicado exclusivamente a `refs/heads/main`

O ruleset não possui atores de bypass. Ele exige Pull Request, resolução das conversas de revisão e
o status check agregado `Required` atualizado com a branch base. Também bloqueia exclusão e
non-fast-forward, impedindo force-push. Assim, pushes diretos de projeto não satisfazem a regra de
Pull Request. O PR permanece draft, aberto e sem merge; nenhuma ação de produção foi executada.
