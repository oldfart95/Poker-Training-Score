import type { RawSession } from "./types";

export const disciplinedSessionFixture: RawSession = {
  id: "fixture-disciplined",
  schemaVersion: "1",
  roomPolicy: "Premium Room",
  mode: "sound_fundamentals",
  heroSeatId: "hero",
  hands: [
    {
      id: "disciplined-1",
      handNumber: 1,
      buttonSeatId: "hero",
      heroHoleCards: ["As", "Kd"],
      seats: [
        { id: "hero", name: "Hero", position: "co", hero: true, stack: 100 },
        { id: "v1", name: "Nit One", position: "sb", archetype: "Nit", stack: 100 },
        { id: "v2", name: "TAG Two", position: "bb", archetype: "TAG", stack: 100 },
      ],
      actions: [
        { seatId: "v1", street: "preflop", type: "post_blind", amount: 0.5 },
        { seatId: "v2", street: "preflop", type: "post_blind", amount: 1 },
        { seatId: "hero", street: "preflop", type: "raise", amount: 3, toAmount: 3, isHero: true },
        { seatId: "v1", street: "preflop", type: "fold", amount: 0 },
        { seatId: "v2", street: "preflop", type: "fold", amount: 0 },
      ],
      results: { heroWon: true, payouts: { hero: 4.5, v1: 0, v2: 0 } },
    },
    {
      id: "disciplined-2",
      handNumber: 2,
      buttonSeatId: "v1",
      heroHoleCards: ["9h", "9s"],
      board: ["9d", "6c", "3h", "Qs", "2d"],
      seats: [
        { id: "hero", name: "Hero", position: "btn", hero: true, stack: 100 },
        { id: "v1", name: "Station", position: "sb", archetype: "Calling Station", stack: 100 },
        { id: "v2", name: "Nit", position: "bb", archetype: "Nit", stack: 100 },
      ],
      actions: [
        { seatId: "v1", street: "preflop", type: "post_blind", amount: 0.5 },
        { seatId: "v2", street: "preflop", type: "post_blind", amount: 1 },
        { seatId: "hero", street: "preflop", type: "raise", amount: 3, toAmount: 3, isHero: true },
        { seatId: "v1", street: "preflop", type: "call", amount: 2.5 },
        { seatId: "v2", street: "preflop", type: "fold", amount: 0 },
        { seatId: "hero", street: "flop", type: "bet", amount: 4, isHero: true },
        { seatId: "v1", street: "flop", type: "call", amount: 4 },
        { seatId: "hero", street: "turn", type: "bet", amount: 10, isHero: true },
        { seatId: "v1", street: "turn", type: "fold", amount: 0 },
      ],
      results: { heroWon: true, payouts: { hero: 25, v1: 0, v2: 0 } },
    },
  ],
};

export const loosePassiveFixture: RawSession = {
  id: "fixture-loose-passive",
  schemaVersion: "1",
  roomPolicy: "Loose Room",
  mode: "sound_fundamentals",
  heroSeatId: "hero",
  hands: [
    {
      id: "loose-1",
      handNumber: 1,
      buttonSeatId: "v1",
      heroHoleCards: ["Jc", "4d"],
      board: ["Kc", "8h", "3s", "2h", "7d"],
      seats: [
        { id: "hero", name: "Hero", position: "bb", hero: true, stack: 100 },
        { id: "v1", name: "TAG One", position: "co", archetype: "TAG", stack: 100 },
        { id: "v2", name: "Nit Blind", position: "sb", archetype: "Nit", stack: 100 },
      ],
      actions: [
        { seatId: "v2", street: "preflop", type: "post_blind", amount: 0.5 },
        { seatId: "hero", street: "preflop", type: "post_blind", amount: 1, isHero: true },
        { seatId: "v1", street: "preflop", type: "raise", amount: 3, toAmount: 3 },
        { seatId: "v2", street: "preflop", type: "fold", amount: 0 },
        { seatId: "hero", street: "preflop", type: "call", amount: 2, isHero: true },
        { seatId: "hero", street: "flop", type: "check", amount: 0, isHero: true },
        { seatId: "v1", street: "flop", type: "bet", amount: 3 },
        { seatId: "hero", street: "flop", type: "call", amount: 3, isHero: true },
        { seatId: "hero", street: "turn", type: "check", amount: 0, isHero: true },
        { seatId: "v1", street: "turn", type: "bet", amount: 8 },
        { seatId: "hero", street: "turn", type: "fold", amount: 0, isHero: true },
      ],
      results: { heroWon: false, payouts: { hero: 0, v1: 20.5, v2: 0 } },
    },
    {
      id: "loose-2",
      handNumber: 2,
      buttonSeatId: "hero",
      heroHoleCards: ["8s", "5s"],
      board: ["Ad", "Kh", "2c", "7c", "Qd"],
      seats: [
        { id: "hero", name: "Hero", position: "btn", hero: true, stack: 100 },
        { id: "v1", name: "Nit Small Blind", position: "sb", archetype: "Nit", stack: 100 },
        { id: "v2", name: "Station", position: "bb", archetype: "Calling Station", stack: 100 },
      ],
      actions: [
        { seatId: "v1", street: "preflop", type: "post_blind", amount: 0.5 },
        { seatId: "v2", street: "preflop", type: "post_blind", amount: 1 },
        { seatId: "hero", street: "preflop", type: "call", amount: 1, isHero: true },
        { seatId: "v1", street: "preflop", type: "fold", amount: 0 },
        { seatId: "v2", street: "preflop", type: "check", amount: 0 },
        { seatId: "v2", street: "flop", type: "check", amount: 0 },
        { seatId: "hero", street: "flop", type: "bet", amount: 2, isHero: true },
        { seatId: "v2", street: "flop", type: "call", amount: 2 },
        { seatId: "v2", street: "turn", type: "check", amount: 0 },
        { seatId: "hero", street: "turn", type: "bet", amount: 6, isHero: true },
        { seatId: "v2", street: "turn", type: "call", amount: 6 },
        { seatId: "v2", street: "river", type: "check", amount: 0 },
        { seatId: "hero", street: "river", type: "bet", amount: 14, isHero: true },
        { seatId: "v2", street: "river", type: "call", amount: 14 },
      ],
      results: { heroWon: false, payouts: { hero: 0, v1: 0, v2: 46.5 } },
    },
  ],
};

export const recklessAdaptiveFixture: RawSession = {
  id: "fixture-reckless-adaptive",
  schemaVersion: "1",
  roomPolicy: "Pressure Room",
  mode: "adaptive_pressure",
  heroSeatId: "hero",
  hands: [
    {
      id: "reckless-1",
      handNumber: 1,
      buttonSeatId: "v1",
      heroHoleCards: ["Qd", "6c"],
      board: ["Ac", "Tc", "3h", "9d", "2s"],
      seats: [
        { id: "hero", name: "Hero", position: "sb", hero: true },
        { id: "v1", name: "Caller", position: "btn", archetype: "Calling Station" },
        { id: "v2", name: "Big Blind", position: "bb", archetype: "TAG" },
      ],
      actions: [
        { seatId: "hero", street: "preflop", type: "post_blind", amount: 0.5, isHero: true },
        { seatId: "v2", street: "preflop", type: "post_blind", amount: 1 },
        { seatId: "v1", street: "preflop", type: "call", amount: 1 },
        { seatId: "hero", street: "preflop", type: "call", amount: 0.5, isHero: true },
        { seatId: "v2", street: "preflop", type: "check", amount: 0 },
        { seatId: "hero", street: "flop", type: "bet", amount: 2, isHero: true },
        { seatId: "v2", street: "flop", type: "fold", amount: 0 },
        { seatId: "v1", street: "flop", type: "call", amount: 2 },
        { seatId: "hero", street: "turn", type: "bet", amount: 5, isHero: true },
        { seatId: "v1", street: "turn", type: "call", amount: 5 },
        { seatId: "hero", street: "river", type: "all_in", amount: 18, isHero: true },
        { seatId: "v1", street: "river", type: "call", amount: 18 },
      ],
      results: { heroWon: false, payouts: { hero: 0, v1: 53, v2: 0 } },
    },
  ],
};

export const strongExploitFixture: RawSession = {
  id: "fixture-strong-exploit",
  schemaVersion: "1",
  roomPolicy: "Pressure Room",
  mode: "adaptive_pressure",
  heroSeatId: "hero",
  hands: [
    {
      id: "exploit-1",
      handNumber: 1,
      buttonSeatId: "hero",
      heroHoleCards: ["Kh", "Qh"],
      board: ["8c", "4d", "2h", "As", "Jd"],
      seats: [
        { id: "hero", position: "btn", hero: true, stack: 100 },
        { id: "v1", position: "sb", archetype: "Nit", stack: 100 },
        { id: "v2", position: "bb", archetype: "TAG", stack: 100 },
      ],
      actions: [
        { seatId: "v1", street: "preflop", type: "post_blind", amount: 0.5 },
        { seatId: "v2", street: "preflop", type: "post_blind", amount: 1 },
        { seatId: "hero", street: "preflop", type: "raise", amount: 3, toAmount: 3, isHero: true },
        { seatId: "v1", street: "preflop", type: "fold", amount: 0 },
        { seatId: "v2", street: "preflop", type: "call", amount: 2 },
        { seatId: "v2", street: "flop", type: "check", amount: 0 },
        { seatId: "hero", street: "flop", type: "bet", amount: 2.5, isHero: true },
        { seatId: "v2", street: "flop", type: "call", amount: 2.5 },
        { seatId: "v2", street: "turn", type: "check", amount: 0 },
        { seatId: "hero", street: "turn", type: "bet", amount: 7, isHero: true },
        { seatId: "v2", street: "turn", type: "fold", amount: 0 },
      ],
      results: { heroWon: true, payouts: { hero: 18.5, v1: 0, v2: 0 } },
    },
  ],
};

export const mixedIntegrityFixture: RawSession = {
  ...disciplinedSessionFixture,
  id: "fixture-mixed-integrity",
  hands: [
    disciplinedSessionFixture.hands![0],
    {
      id: "mixed-invalid",
      handNumber: 2,
      buttonSeatId: "v1",
      heroHoleCards: ["Ah", "Qc"],
      seats: [
        { id: "hero", position: "btn", hero: true, stack: 80 },
        { id: "v1", position: "sb", archetype: "TAG", stack: 0, busted: true },
        { id: "v2", position: "bb", archetype: "Nit", stack: 80 },
      ],
      actions: [
        { seatId: "v1", street: "preflop", type: "post_blind", amount: 0.5 },
        { seatId: "v2", street: "preflop", type: "post_blind", amount: 1 },
        { seatId: "hero", street: "preflop", type: "raise", amount: 3, isHero: true },
      ],
      results: { heroWon: true, payouts: { hero: 4.5, v1: 0, v2: 0 } },
    },
  ],
};

export const allFixtures = {
  disciplinedSessionFixture,
  loosePassiveFixture,
  recklessAdaptiveFixture,
  strongExploitFixture,
  mixedIntegrityFixture,
};
