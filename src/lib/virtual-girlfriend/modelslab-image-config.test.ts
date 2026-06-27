import { describe, expect, it } from "vitest";
import {
  isFlux2ProPortraitModel,
  isRealVisXlPortraitModel,
  resolveModelsLabPortraitFallbackModel,
  resolveModelsLabPortraitModel,
} from "./modelslab-image-config";

describe("modelslab-image-config", () => {
  it("defaults portrait model to flux-2-pro", () => {
    expect(resolveModelsLabPortraitModel()).toBe("flux-2-pro");
  });

  it("defaults portrait fallback to realvisxl-v30", () => {
    expect(resolveModelsLabPortraitFallbackModel()).toBe("realvisxl-v30");
  });

  it("detects flux-2-pro portrait model", () => {
    expect(isFlux2ProPortraitModel("flux-2-pro")).toBe(true);
    expect(isFlux2ProPortraitModel("realvisxl-v30")).toBe(false);
  });

  it("detects realvisxl portrait model", () => {
    expect(isRealVisXlPortraitModel("realvisxl-v30")).toBe(true);
    expect(isRealVisXlPortraitModel("flux-2-pro")).toBe(false);
  });
});