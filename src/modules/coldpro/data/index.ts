/**
 * Dados técnicos, parsers e tabelas de referência.
 * Inclui parsers Unilab, importadores VAPCYC e geometria default do sistema.
 */

// Parsers Unilab
export * from "../unilab/unilabCondenserParser";
export * from "../unilab/unilabEvaporatorParser";
export * from "../unilab/unilabExtractor";
export * from "../unilab/unilabSniffer";

// Repositórios / mappers Unilab (dados estruturados, não chamam API)
export * from "../unilabData/csv";
export * from "../unilabData/unilabGeometryFactorMapper";
export * from "../unilabData/unilabGeometryFactorRepository";
export * from "../coil/unilab/unilabRepository";
export * from "../coil/unilab/unilabMapper";

// Defaults técnicos do sistema
export * from "../system/systemGeometryDefaults";

// Importador VAPCYC (parsing de planilhas / CSVs)
export * from "../importers/vapcycImporter";

// Importador de fatores Unilab (parsing)
export * from "../unilabData/unilabGeometryFactorImporter";
