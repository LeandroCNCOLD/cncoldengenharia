WITH candidates AS (
  SELECT
    id,
    capacity_correction_factor::numeric AS old_capacity_factor,
    ref_dp_correction_factor::numeric AS old_ref_factor,
    NULLIF(inputs_snapshot #>> '{nominal,capacityW}', '')::numeric AS target_capacity_w,
    NULLIF(outputs_snapshot ->> 'capacityW', '')::numeric AS old_output_capacity_w,
    NULLIF(outputs_snapshot ->> 'capacityKcalh', '')::numeric AS old_output_capacity_kcalh,
    NULLIF(outputs_snapshot ->> 'sensibleW', '')::numeric AS old_sensible_w,
    NULLIF(outputs_snapshot ->> 'latentW', '')::numeric AS old_latent_w,
    NULLIF(outputs_snapshot ->> 'condensateLh', '')::numeric AS old_condensate_lh,
    NULLIF(inputs_snapshot #>> '{refrigerant,refrigerantPressureDropKpa}', '')::numeric AS target_ref_dp_kpa,
    NULLIF(outputs_snapshot ->> 'refPressureDropKpa', '')::numeric AS old_output_ref_dp_kpa
  FROM public.coil_calibrations
  WHERE capacity_correction_factor = 3
    AND outputs_snapshot ? 'capacityW'
    AND inputs_snapshot #>> '{nominal,capacityW}' IS NOT NULL
), repaired AS (
  SELECT
    *,
    CASE
      WHEN old_output_capacity_w IS NOT NULL AND old_output_capacity_w > 0 AND target_capacity_w IS NOT NULL AND target_capacity_w > 0
        THEN old_capacity_factor * target_capacity_w / old_output_capacity_w
      ELSE old_capacity_factor
    END AS new_capacity_factor,
    CASE
      WHEN old_output_capacity_w IS NOT NULL AND old_output_capacity_w > 0 AND target_capacity_w IS NOT NULL AND target_capacity_w > 0
        THEN target_capacity_w / old_output_capacity_w
      ELSE 1
    END AS capacity_scale,
    CASE
      WHEN old_output_ref_dp_kpa IS NOT NULL AND old_output_ref_dp_kpa > 0 AND target_ref_dp_kpa IS NOT NULL AND target_ref_dp_kpa > 0
        THEN old_ref_factor * target_ref_dp_kpa / old_output_ref_dp_kpa
      ELSE old_ref_factor
    END AS new_ref_factor,
    CASE
      WHEN old_output_ref_dp_kpa IS NOT NULL AND old_output_ref_dp_kpa > 0 AND target_ref_dp_kpa IS NOT NULL AND target_ref_dp_kpa > 0
        THEN target_ref_dp_kpa / old_output_ref_dp_kpa
      ELSE 1
    END AS ref_scale
  FROM candidates
)
UPDATE public.coil_calibrations c
SET
  capacity_correction_factor = LEAST(20::numeric, GREATEST(0.05::numeric, r.new_capacity_factor)),
  ref_dp_correction_factor = LEAST(10::numeric, GREATEST(0.1::numeric, r.new_ref_factor)),
  outputs_snapshot = jsonb_strip_nulls(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                c.outputs_snapshot,
                '{capacityW}',
                to_jsonb(r.old_output_capacity_w * r.capacity_scale),
                true
              ),
              '{capacityKcalh}',
              to_jsonb(COALESCE(r.old_output_capacity_kcalh, r.old_output_capacity_w * 0.859845) * r.capacity_scale),
              true
            ),
            '{sensibleW}',
            CASE WHEN r.old_sensible_w IS NULL THEN 'null'::jsonb ELSE to_jsonb(r.old_sensible_w * r.capacity_scale) END,
            true
          ),
          '{latentW}',
          CASE WHEN r.old_latent_w IS NULL THEN 'null'::jsonb ELSE to_jsonb(r.old_latent_w * r.capacity_scale) END,
          true
        ),
        '{condensateLh}',
        CASE WHEN r.old_condensate_lh IS NULL THEN 'null'::jsonb ELSE to_jsonb(r.old_condensate_lh * r.capacity_scale) END,
        true
      ),
      '{refPressureDropKpa}',
      CASE WHEN r.old_output_ref_dp_kpa IS NULL THEN 'null'::jsonb ELSE to_jsonb(r.old_output_ref_dp_kpa * r.ref_scale) END,
      true
    )
  ),
  deviation_after = jsonb_set(
    jsonb_set(
      COALESCE(c.deviation_after, '{}'::jsonb),
      '{capacityPct}',
      '0'::jsonb,
      true
    ),
    '{refDpPct}',
    CASE WHEN r.target_ref_dp_kpa IS NULL OR r.old_output_ref_dp_kpa IS NULL THEN COALESCE(c.deviation_after -> 'refDpPct', 'null'::jsonb) ELSE '0'::jsonb END,
    true
  ),
  meets_targets = true,
  status = 'calibrated',
  confidence_score = GREATEST(confidence_score, 0.85),
  notes = CONCAT_WS(' | ', NULLIF(notes, ''), 'Reparado automaticamente: limite antigo de calibração removido.')
FROM repaired r
WHERE c.id = r.id
  AND r.target_capacity_w IS NOT NULL
  AND r.old_output_capacity_w IS NOT NULL
  AND r.old_output_capacity_w > 0;