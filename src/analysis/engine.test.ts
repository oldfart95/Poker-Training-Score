import { describe, expect, it } from "vitest";
import { classifyBoardTexture, classifyPostflop, classifyPreflop } from "./classification";
import { disciplinedSessionFixture, loosePassiveFixture, recklessAdaptiveFixture } from "./fixtures";
import { parseSession } from "./parser";
import { reviewSession } from "./scoring";

describe("session parser", () => {
  it("parses hands and hero cards", () => {
    const parsed = parseSession(disciplinedSessionFixture);
    expect(parsed.session.hands).toHaveLength(2);
    expect(parsed.session.hands[0].heroHoleCards).toEqual(["As", "Kd"]);
  });
});

describe("classifiers", () => {
  it("classifies preflop buckets", () => {
    expect(classifyPreflop(["As", "Ah"])).toBe("premium_pair");
    expect(classifyPreflop(["7s", "6s"])).toBe("suited_connector");
    expect(classifyPreflop(["Jc", "4d"])).toBe("offsuit_trash");
  });

  it("classifies board texture and postflop strength", () => {
    expect(classifyBoardTexture(["Ah", "Kd", "2c"]).primary).toBe("dry");
    expect(classifyBoardTexture(["9h", "8h", "7d"]).primary).toBe("wet");
    expect(classifyPostflop(["As", "Kd"], ["Ah", "7d", "2c"])).toBe("top_pair_good_kicker");
  });
});

describe("scoring engine", () => {
  it("scores disciplined hands higher than loose passive leaks", () => {
    const disciplined = reviewSession(parseSession(disciplinedSessionFixture).session, "sound_fundamentals");
    const loose = reviewSession(parseSession(loosePassiveFixture).session, "sound_fundamentals");
    expect(disciplined.overallScore).toBeGreaterThan(loose.overallScore);
  });

  it("changes scoring by philosophy without excusing spew", () => {
    const parsed = parseSession(recklessAdaptiveFixture).session;
    const sound = reviewSession(parsed, "sound_fundamentals");
    const adaptive = reviewSession(parsed, "adaptive_pressure");
    expect(adaptive.overallScore).toBeGreaterThanOrEqual(sound.overallScore - 5);
    expect(adaptive.leaks.some((leak) => leak.tag === "pressure_without_target" || leak.tag === "spewy_all_in")).toBe(true);
  });
});
