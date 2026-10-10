import test from "node:test";
import assert from "node:assert/strict";
import { buildExportFileName, getMimeType } from "./export-helper.mjs";

test("buildExportFileName produces valid filenames with extension", () => {
  const pngName = buildExportFileName("my-edit", "png");
  assert.ok(pngName.startsWith("my-edit-"));
  assert.ok(pngName.endsWith(".png"));

  const jpegName = buildExportFileName("my-edit", "jpeg");
  assert.ok(jpegName.startsWith("my-edit-"));
  assert.ok(jpegName.endsWith(".jpg"));
});

test("buildExportFileName sanitizes invalid filename characters", () => {
  const name = buildExportFileName("test/foo:bar?*", "png");
  assert.ok(!name.includes("/"));
  assert.ok(!name.includes(":"));
  assert.ok(!name.includes("?"));
  assert.ok(!name.includes("*"));
  assert.ok(name.endsWith(".png"));
});

test("getMimeType returns correct mime types", () => {
  assert.equal(getMimeType("png"), "image/png");
  assert.equal(getMimeType("jpeg"), "image/jpeg");
});
