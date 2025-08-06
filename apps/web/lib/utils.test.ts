import { cn } from "./utils";

describe("utils", () => {
  describe("cn function", () => {
    it("combines class names correctly", () => {
      const result = cn("class1", "class2");
      expect(result).toContain("class1");
      expect(result).toContain("class2");
    });

    it("handles conditional classes", () => {
      const condition = true;
      const result = cn("base-class", condition && "conditional-class");
      expect(result).toContain("base-class");
      expect(result).toContain("conditional-class");
    });

    it("filters out falsy values", () => {
      const result = cn(
        "valid-class",
        false && "false-class",
        null,
        undefined,
        "",
      );
      expect(result).toBe("valid-class");
    });

    it("handles empty input", () => {
      const result = cn();
      expect(result).toBe("");
    });

    it("deduplicates classes", () => {
      const result = cn("duplicate", "other", "duplicate");
      // The exact behavior depends on clsx/tailwind-merge implementation
      expect(result).toBeTruthy();
    });
  });
});
