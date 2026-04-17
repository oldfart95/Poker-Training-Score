import { describe, expect, it } from "vitest";
import { classifyBoardTexture, classifyPostflop, classifyPreflop } from "./classification";
import { disciplinedSessionFixture, loosePassiveFixture, mixedIntegrityFixture, recklessAdaptiveFixture } from "./fixtures";
import { parseSession } from "./parser";
import { reviewSession } from "./scoring";
import type { RawSession } from "./types";

describe("session parser and integrity pipeline", () => {
  it("accepts a fully valid session", () => {
    const parsed = parseSession(disciplinedSessionFixture);
    expect(parsed.session.hands).toHaveLength(2);
    expect(parsed.integrity.validHands).toBe(2);
    expect(parsed.integrity.invalidHands).toBe(0);
  });

  it("accepts the native Pocket Pixel export schema", () => {
    const fixture: RawSession = {
      formatVersion: "1.0.0",
      schemaVersion: "1.0.0",
      app: "Pocket Pixel Poker",
      session: {
        id: "ppp-session",
        startedAt: "2026-04-17T02:35:43.573Z",
        mode: "full-ring",
        roomPolicy: "exploit",
        heroSeat: 0,
      },
      players: [
        { seat: 0, name: "Hero", archetype: "Hero", isHero: true },
        { seat: 1, name: "Nit", archetype: "Nit", isHero: false },
        { seat: 2, name: "TAG", archetype: "TAG", isHero: false },
      ],
      hands: [
        {
          handNumber: 1,
          handId: "ppp-hand-1",
          heroSeat: 0,
          buttonSeat: 0,
          activePlayersAtStart: [
            { seat: 0, name: "Hero", position: "BTN", isHero: true, stack: 100 },
            { seat: 1, name: "Nit", position: "SB", isHero: false, stack: 100 },
            { seat: 2, name: "TAG", position: "BB", isHero: false, stack: 100 },
          ],
          startingStacks: { "0": 100, "1": 100, "2": 100 },
          heroHoleCards: ["As", "Kd"],
          board: { flop: ["Ah", "7d", "2c"], turn: "9s", river: "3h" },
          actions: [
            { actorSeat: 1, street: "preflop", action: "post_blind", amount: 0.5 },
            { actorSeat: 2, street: "preflop", action: "post_blind", amount: 1 },
            { actorSeat: 0, street: "preflop", action: "raise", amount: 3, toAmount: 3, isHero: true },
            { actorSeat: 1, street: "preflop", action: "fold", amount: 0 },
            { actorSeat: 2, street: "preflop", action: "call", amount: 2 },
            { actorSeat: 2, street: "flop", action: "check", amount: 0 },
            { actorSeat: 0, street: "flop", action: "check", amount: 0, isHero: true },
            { actorSeat: 2, street: "turn", action: "check", amount: 0 },
            { actorSeat: 0, street: "turn", action: "check", amount: 0, isHero: true },
            { actorSeat: 2, street: "river", action: "check", amount: 0 },
            { actorSeat: 0, street: "river", action: "check", amount: 0, isHero: true },
          ],
          result: {
            showdown: true,
            winnerSeats: [0],
            winners: [{ seat: 0, name: "Hero", amountWon: 6.5 }],
            heroWon: true,
          },
        },
      ],
      summary: { hands: 1, netBb: 2 },
    };

    const parsed = parseSession(fixture);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.session.heroSeatId).toBe("seat-0");
    expect(parsed.session.hands[0]?.buttonSeatId).toBe("seat-0");
    expect(parsed.session.hands[0]?.actions[0]?.actorId).toBe("seat-1");
    expect(parsed.session.hands[0]?.board).toEqual(["Ah", "7d", "2c", "9s", "3h"]);
    expect(parsed.integrity.validHands).toBe(1);
    expect(parsed.integrity.invalidHands).toBe(0);
  });

  it("flags mixed valid and invalid hands before scoring", () => {
    const parsed = parseSession(mixedIntegrityFixture);
    expect(parsed.integrity.validHands).toBe(1);
    expect(parsed.integrity.invalidHands).toBe(1);
    expect(parsed.integrity.handReports[1].status).not.toBe("valid");
    expect(parsed.integrity.handReports[1].issues.some((issue) => issue.code === "busted_posted_blind")).toBe(true);
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

describe("strict invalid-hand detection", () => {
  it("rejects repeated same-player actions", () => {
    const fixture: RawSession = {
      schemaVersion: "1",
      heroSeatId: "hero",
      hands: [
        {
          handNumber: 1,
          heroHoleCards: ["As", "Ks"],
          seats: [
            { id: "hero", hero: true, position: "btn", stack: 100 },
            { id: "v1", position: "sb", stack: 100 },
            { id: "v2", position: "bb", stack: 100 },
          ],
          actions: [
            { seatId: "v1", street: "preflop", type: "post_blind", amount: 0.5 },
            { seatId: "v2", street: "preflop", type: "post_blind", amount: 1 },
            { seatId: "hero", street: "preflop", type: "raise", amount: 3, isHero: true },
            { seatId: "hero", street: "preflop", type: "raise", amount: 6, isHero: true },
          ],
        },
      ],
    };
    const parsed = parseSession(fixture);
    expect(parsed.integrity.handReports[0].issues.some((issue) => issue.code === "repeated_same_player_action")).toBe(true);
  });

  it("rejects busted seats posting blinds", () => {
    const parsed = parseSession(mixedIntegrityFixture);
    expect(parsed.integrity.handReports[1].issues.some((issue) => issue.code === "busted_posted_blind")).toBe(true);
  });

  it("rejects impossible call/check/raise labels", () => {
    const fixture: RawSession = {
      schemaVersion: "1",
      heroSeatId: "hero",
      hands: [
        {
          handNumber: 1,
          heroHoleCards: ["Qs", "Qd"],
          seats: [
            { id: "hero", hero: true, position: "btn" },
            { id: "v1", position: "sb" },
            { id: "v2", position: "bb" },
          ],
          actions: [
            { seatId: "v1", street: "preflop", type: "post_blind", amount: 0.5 },
            { seatId: "v2", street: "preflop", type: "post_blind", amount: 1 },
            { seatId: "hero", street: "preflop", type: "check", amount: 0, isHero: true },
            { seatId: "v1", street: "preflop", type: "call", amount: 0 },
            { seatId: "v2", street: "preflop", type: "raise", amount: 1, toAmount: 1 },
          ],
        },
      ],
    };
    const parsed = parseSession(fixture);
    const codes = parsed.integrity.handReports[0].issues.map((issue) => issue.code);
    expect(codes).toContain("illegal_check");
    expect(codes).toContain("impossible_call_label");
    expect(codes).toContain("raise_not_above_call");
  });

  it("rejects payout mismatch", () => {
    const fixture: RawSession = {
      ...disciplinedSessionFixture,
      hands: [
        {
          ...disciplinedSessionFixture.hands![0],
          results: { heroWon: true, payouts: { hero: 99 } },
        },
      ],
    };
    const parsed = parseSession(fixture);
    expect(parsed.integrity.handReports[0].issues.some((issue) => issue.code === "payout_mismatch")).toBe(true);
  });

  it("rejects malformed showdown payloads", () => {
    const fixture: RawSession = {
      schemaVersion: "1",
      heroSeatId: "hero",
      hands: [
        {
          handNumber: 1,
          heroHoleCards: ["Ad", "Kd"],
          board: ["Ah", "7d", "2c"],
          seats: [
            { id: "hero", hero: true, position: "btn" },
            { id: "v1", position: "bb" },
          ],
          actions: [
            { seatId: "v1", street: "preflop", type: "post_blind", amount: 1 },
            { seatId: "hero", street: "preflop", type: "call", amount: 1, isHero: true },
            { seatId: "v1", street: "flop", type: "check", amount: 0 },
            { seatId: "hero", street: "flop", type: "check", amount: 0, isHero: true },
          ],
          results: { showdown: "broken" },
        },
      ],
    };
    const parsed = parseSession(fixture);
    expect(parsed.integrity.handReports[0].issues.some((issue) => issue.code === "malformed_showdown")).toBe(true);
  });
});

describe("scoring architecture", () => {
  it("scores disciplined hands higher than loose passive leaks", () => {
    const disciplined = reviewSession(parseSession(disciplinedSessionFixture), "sound_fundamentals");
    const loose = reviewSession(parseSession(loosePassiveFixture), "sound_fundamentals");
    expect((disciplined.overallScore ?? 0)).toBeGreaterThan(loose.overallScore ?? 0);
  });

  it("changes scoring by philosophy without excusing spew", () => {
    const parsed = parseSession(recklessAdaptiveFixture);
    const sound = reviewSession(parsed, "sound_fundamentals");
    const adaptive = reviewSession(parsed, "adaptive_pressure");
    expect((adaptive.overallScore ?? 0)).toBeGreaterThanOrEqual((sound.overallScore ?? 0) - 5);
    expect(adaptive.overview.topCautionSpots.some((spot) => spot.ruleTriggers.some((rule) => rule.id === "major_spew_oversized_pot"))).toBe(true);
  });

  it("downgrades confidence when most hands are invalid", () => {
    const invalidHand = mixedIntegrityFixture.hands![1]!;
    const invalidHeavy: RawSession = {
      ...mixedIntegrityFixture,
      hands: [
        { ...invalidHand, id: "invalid-a", handNumber: 1 },
        { ...invalidHand, id: "invalid-b", handNumber: 2 },
        { ...invalidHand, id: "invalid-c", handNumber: 3 },
        { ...disciplinedSessionFixture.hands![0]!, id: "valid-d", handNumber: 4 },
      ],
    };
    const report = reviewSession(parseSession(invalidHeavy), "sound_fundamentals");
    expect(report.confidence).toBe("low");
    expect(report.overallScore).toBeNull();
    expect(report.quickSummary).toContain("Only 1 of 4 hands were valid enough for strategic scoring.");
  });
});
