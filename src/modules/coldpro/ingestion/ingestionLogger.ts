// Logger técnico simples. No futuro pode ser plugado em telemetria.

type LogPayload = {
  fileId?: string;
  filename?: string;
  parser?: string;
  durationMs?: number;
  fieldsFound?: number;
  fieldsMissing?: string[];
  warnings?: string[];
  errors?: string[];
};

export function logIngestion(stage: string, payload: LogPayload) {
  // eslint-disable-next-line no-console
  console.info(`[ingestion:${stage}]`, payload);
}
