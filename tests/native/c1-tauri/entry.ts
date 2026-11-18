void (import.meta.env.MODE === "c1-media" ? import("./media-scenario")
  : import.meta.env.MODE === "c1-tsv" ? import("./tsv-scenario") : import("./scenario"));
