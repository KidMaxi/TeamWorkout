import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error node needs the .ts extension; tsconfig does not allow it
import { firstName, genitiveNl, genitiveEn, possessive, pickChild, normalizeCode, isCodeShape } from "./parent.ts";

test("firstName takes the first word", () => {
  assert.equal(firstName("  Noah de Vries "), "Noah");
  assert.equal(firstName(null), "");
  assert.equal(firstName(""), "");
});

test("Dutch genitive", () => {
  assert.equal(genitiveNl("Noah"), "Noahs");
  assert.equal(genitiveNl("Max"), "Max'");
  assert.equal(genitiveNl("Lars"), "Lars'");
  assert.equal(genitiveNl("Fenz"), "Fenz'");
  assert.equal(genitiveNl("LARS"), "LARS'");
  assert.equal(genitiveNl(""), "");
});

test("English genitive and possessive per locale", () => {
  assert.equal(genitiveEn("Noah"), "Noah's");
  assert.equal(possessive("Noah de Vries", "nl"), "Noahs");
  assert.equal(possessive("Max Mulder", "nl"), "Max'");
  assert.equal(possessive("Noah de Vries", "en"), "Noah's");
  assert.equal(possessive(null, "en"), "");
});

test("pickChild validates the param against the list", () => {
  const kids = [{ id: "a" }, { id: "b" }];
  assert.equal(pickChild(kids, "b")?.id, "b");
  assert.equal(pickChild(kids, ["b", "a"])?.id, "b");
  assert.equal(pickChild(kids, "zzz")?.id, "a");
  assert.equal(pickChild(kids, undefined)?.id, "a");
  assert.equal(pickChild([], "a"), null);
});

test("normalizeCode and isCodeShape", () => {
  assert.equal(normalizeCode(" ab12-cd34 ef "), "AB12CD34EF");
  assert.equal(normalizeCode("abcdefghijklmnop"), "ABCDEFGHIJ");
  assert.equal(normalizeCode(null), "");
  assert.ok(isCodeShape("AB12CD34EF"));
  assert.ok(!isCodeShape("AB12"));
  assert.ok(!isCodeShape("AB12CD34E!"));
});
