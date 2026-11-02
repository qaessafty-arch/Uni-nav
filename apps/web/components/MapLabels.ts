import type { FloorMapLabels } from "@campusnav/map-web";
import type { MessageKey, Params } from "@campusnav/i18n";

export function mapLabels(t: (k: MessageKey, p?: Params) => string): FloorMapLabels {
  return {
    zoomIn: t("map.zoomIn"),
    zoomOut: t("map.zoomOut"),
    reset: t("map.reset"),
    youAreHere: t("map.youAreHere"),
    destination: t("map.destination"),
    checkpoint: t("map.checkpoint"),
    mapOf: t("map.campus"),
  };
}
