import { describe, expect, it } from "vitest";
import { fileSize } from "./file-size";

describe("fileSize", () => {
  it("zeigt Bytes, Kilobytes und Megabytes wie die Anhangsliste", () => {
    expect(fileSize(1000)).toBe("1000 B");
    expect(fileSize(1024)).toBe("1 KB");
    expect(fileSize(245_000)).toBe("239 KB");
    expect(fileSize(1024 ** 2)).toBe("1.0 MB");
    expect(fileSize(1_840_000)).toBe("1.8 MB");
  });
});
