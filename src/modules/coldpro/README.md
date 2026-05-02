# ColdPro (frontend)

Camada de apresentação do sistema técnico ColdPro V2.

## Estrutura

```
src/modules/coldpro/
├── components/   # Componentes de UI específicos do domínio
├── screens/      # Telas completas (compostas em rotas)
├── services/     # Clientes para server functions / Supabase
└── types/        # Tipos TypeScript do domínio
```

## Regras

- Esta camada **não contém lógica de cálculo termodinâmico**.
- Toda matemática vive em `src/modules/coldpro_v2`.
- Componentes consomem `coldpro_v2` apenas via `services/`.
- Nada de imports cruzados diretos entre `screens/` de telas distintas.
