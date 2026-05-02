# ATUALIZAÇÃO: Catálogo Completo de Fluidos UNILAB

**Contexto:**
Precisamos expandir os catálogos atuais do projeto para incluir todos os 123 refrigerantes puros, 103 misturas e 982 fluidos secundários do banco de dados UNILAB original.

### 1. Atualizar Tipagens

Em `src/modules/cn_coils/types/catalogs.ts`, atualize/adicione:

```typescript
export interface Refrigerant {
  id: string;
  name: string;
  shortName: string;
  fileName: string;
  cas?: string;
  chemicalName?: string;
  chemicalFormula?: string;
  commercialName?: string;
  synonym?: string;
  maxTempC?: number;
  maxPressKPa?: number;
  isMixture: boolean;
  unilab: boolean;
}

export interface SecondaryFluid {
  id: string;
  name: string;
  fileName: string;
  type: 'liquid' | 'liquid_mixture' | 'gas';
  tipologia: number;
  guid?: string;
  unilab: boolean;
  requiresPressure: boolean;
  raoult?: {
    pm1: number;
    ka1: number;
    kb1: number;
    kc1: number;
  };
}
```

### 2. Atualizar Componente de Seleção de Fluido

Em `FluidSide.tsx` ou no componente que renderiza o `<select>` de fluido:
- Exiba o `shortName` (ex: R404A).
- Se houver `commercialName`, exiba entre parênteses (ex: "R449A (Opteon™ XP40)").
- Ordene alfabeticamente.
- **Garanta que o `onChange` ou `onValueChange` esteja conectado ao store (`updatePhysicalInputs({ fluid: value })`).**

### 3. Atualizar os arquivos JSON em `public/data/catalogs/`

Substitua o conteúdo dos 3 arquivos abaixo pelo conteúdo dos blocos de código (por causa do limite de caracteres do chat, baixe os arquivos ou use os scripts para gerar, mas aqui estão os primeiros itens de cada um como referência estrutural):

**refrigerantsPure.json**
```json
[
  {
    "id": "REF_1_1_1_2_2_4_5_5_5_nonafluoro_4__trifluoromethyl__3_pentanone",
    "name": "Dodecafluoro-2-methylpentan-3-one",
    "shortName": "1,1,1,2,2,4,5,5,5-nonafluoro-4-(trifluoromethyl)-3-pentanone",
    "fileName": "NOVEC649.FLD",
    "cas": "756-13-8",
    "chemicalName": "Dodecafluoro-2-methylpentan-3-one",
    "chemicalFormula": "CF3CF2C(=O)CF(CF3)2",
    "commercialName": "1,1,1,2,2,4,5,5,5-nonafluoro-4-(trifluoromethyl)-3-pentanone",
    "synonym": "Novec 649, 1230, FK-5-1-12",
    "maxTempC": 0.0,
    "maxPressKPa": 0.0,
    "isMixture": false,
    "unilab": true
  },
  {
    "id": "REF_D4",
    "name": "octamethylcyclotetrasiloxane",
    "shortName": "D4",
    "fileName": "D4.FLD",
    "cas": "556-67-2",
    "chemicalName": "octamethylcyclotetrasiloxane",
    "chemicalFormula": "C8H24O4Si4",
    "commercialName": "D4",
  // ... mais 120 itens
\n]\n```
**refrigerantsMixtures.json**
```json
[
  {
    "id": "REF_AIR",
    "name": "AIR",
    "shortName": "AIR",
    "fileName": "AIR.MIX",
    "cas": null,
    "chemicalName": null,
    "chemicalFormula": null,
    "commercialName": null,
    "synonym": null,
    "maxTempC": -1.0,
    "maxPressKPa": -1.0,
    "isMixture": true,
    "unilab": true
  },
  {
    "id": "REF_EKOFISK",
    "name": "EKOFISK",
    "shortName": "EKOFISK",
    "fileName": "EKOFISK.MIX",
    "cas": null,
    "chemicalName": null,
    "chemicalFormula": null,
    "commercialName": null,
  // ... mais 100 itens
\n]\n```
**secondaryFluids.json**
```json
[
  {
    "id": "SF_0_CRESOL",
    "name": "0-CRESOL",
    "fileName": "0-CRESOL.FGSP",
    "type": "gas",
    "tipologia": 13,
    "guid": "C256090E-3B28-45F0-A4A2-2D9202640E5E",
    "unilab": true,
    "requiresPressure": false,
    "raoult": {
      "pm1": 0.0,
      "ka1": 0.0,
      "kb1": 0.0,
      "kc1": 0.0
    }
  },
  {
    "id": "SF_0_XILENE",
    "name": "0-XILENE",
    "fileName": "0-XILENE.FGSP",
    "type": "gas",
    "tipologia": 13,
    "guid": "27A18F63-0741-403C-8D8B-3A1CE3DEC34C",
    "unilab": true,
  // ... mais 980 itens
\n]\n```

> **Nota para a IA:** O usuário anexará os 3 arquivos JSON completos (.json ou .zip) nesta mesma mensagem ou na próxima. Por favor, leia os arquivos anexados e grave-os integralmente em `public/data/catalogs/`.
