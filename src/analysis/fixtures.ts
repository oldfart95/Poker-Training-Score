import type { RawSession } from "./types";

export const disciplinedSessionFixture: RawSession = {
  id: "fixture-disciplined",
  roomPolicy: "Premium Room",
  mode: "sound_fundamentals",
  heroSeatId: "hero",
  hands: [
    {
      handNumber: 1,
      heroHoleCards: ["As", "Kd"],
      seats: [
        { id: "hero", name: "Hero", position: "co", hero: true },
        { id: "v1", name: "Nit One", position: "bb", archetype: "Nit" },
      ],
      board: ["Ah", "7d", "2c", "Tc", "3s"],
      actions: [
        { seatId: "hero", street: "preflop", type: "raise", amount: 3, pot: 1.5, isHero: true },
        { seatId: "v1", street: "preflop", type: "call", amount: 2.5, pot: 6 },
        { seatId: "hero", street: "flop", type: "bet", amount: 3, pot: 9, isHero: true },
        { seatId: "v1", street: "flop", type: "fold", amount: 0, pot: 9 },
      ],
      results: { heroWon: true },
    },
    {
      handNumber: 2,
      heroHoleCards: ["9h", "9s"],
      seats: [
        { id: "hero", name: "Hero", position: "btn", hero: true },
        { id: "v2", name: "Station", position: "bb", archetype: "Calling Station" },
      ],
      board: ["9d", "6c", "3h", "Qs", "2d"],
      actions: [
        { seatId: "hero", street: "preflop", type: "raise", amount: 2.5, pot: 1.5, isHero: true },
        { seatId: "v2", street: "preflop", type: "call", amount: 1.5, pot: 5 },
        { seatId: "hero", street: "flop", type: "bet", amount: 3.5, pot: 8, isHero: true },
        { seatId: "v2", street: "flop", type: "call", amount: 3.5, pot: 15 },
        { seatId: "hero", street: "turn", type: "bet", amount: 9, pot: 24, isHero: true },
        { seatId: "v2", street: "turn", type: "call", amount: 9, pot: 33 },
      ],
      results: { heroWon: true },
    },
  ],
};

export const loosePassiveFixture: RawSession = {
  id: "fixture-loose-passive",
  roomPolicy: "Loose Room",
  mode: "sound_fundamentals",
  heroSeatId: "hero",
  hands: [
    {
      handNumber: 1,
      heroHoleCards: ["Jc", "4d"],
      seats: [
        { id: "hero", position: "bb", hero: true },
        { id: "v1", position: "co", archetype: "TAG" },
      ],
      board: ["Kc", "8h", "3s", "2h", "7d"],
      actions: [
        { seatId: "v1", street: "preflop", type: "raise", amount: 3, pot: 1.5 },
        { seatId: "hero", street: "preflop", type: "call", amount: 2, pot: 4.5, isHero: true },
        { seatId: "hero", street: "flop", type: "check", amount: 0, pot: 4.5, isHero: true },
        { seatId: "v1", street: "flop", type: "bet", amount: 3, pot: 7.5 },
        { seatId: "hero", street: "flop", type: "call", amount: 3, pot: 10.5, isHero: true },
      ],
      results: { heroWon: false },
    },
    {
      handNumber: 2,
      heroHoleCards: ["8s", "5s"],
      seats: [
        { id: "hero", position: "btn", hero: true },
        { id: "v2", position: "bb", archetype: "Calling Station" },
      ],
      board: ["Ad", "Kh", "2c", "7c", "Qd"],
      actions: [
        { seatId: "hero", street: "preflop", type: "call", amount: 2, pot: 3.5, isHero: true },
        { seatId: "hero", street: "flop", type: "bet", amount: 2.5, pot: 6, isHero: true },
        { seatId: "v2", street: "flop", type: "call", amount: 2.5, pot: 8.5 },
        { seatId: "hero", street: "turn", type: "bet", amount: 6, pot: 14.5, isHero: true },
        { seatId: "v2", street: "turn", type: "call", amount: 6, pot: 20.5 },
        { seatId: "hero", street: "river", type: "bet", amount: 14, pot: 34.5, isHero: true },
      ],
      results: { heroWon: false },
    },
  ],
};

export const recklessAdaptiveFixture: RawSession = {
  id: "fixture-reckless-adaptive",
  roomPolicy: "Pressure Room",
  mode: "adaptive_pressure",
  heroSeatId: "hero",
  hands: [
    {
      handNumber: 1,
      heroHoleCards: ["Qd", "6c"],
      seats: [
        { id: "hero", position: "sb", hero: true },
        { id: "v1", position: "btn", archetype: "Calling Station" },
      ],
      board: ["Ac", "Tc", "3h", "9d", "2s"],
      actions: [
        { seatId: "hero", street: "preflop", type: "call", amount: 0.5, pot: 1.5, isHero: true },
        { seatId: "hero", street: "flop", type: "bet", amount: 2, pot: 3.5, isHero: true },
        { seatId: "v1", street: "flop", type: "call", amount: 2, pot: 5.5 },
        { seatId: "hero", street: "turn", type: "bet", amount: 5, pot: 10.5, isHero: true },
        { seatId: "v1", street: "turn", type: "call", amount: 5, pot: 15.5 },
        { seatId: "hero", street: "river", type: "all_in", amount: 24, pot: 39.5, isHero: true },
      ],
      results: { heroWon: false },
    },
  ],
};

export const strongExploitFixture: RawSession = {
  id: "fixture-strong-exploit",
  roomPolicy: "Pressure Room",
  mode: "adaptive_pressure",
  heroSeatId: "hero",
  hands: [
    {
      handNumber: 1,
      heroHoleCards: ["Kh", "Qh"],
      seats: [
        { id: "hero", position: "btn", hero: true },
        { id: "v1", position: "bb", archetype: "Nit" },
      ],
      board: ["8c", "4d", "2h", "As", "Jd"],
      actions: [
        { seatId: "hero", street: "preflop", type: "raise", amount: 2.5, pot: 1.5, isHero: true },
        { seatId: "v1", street: "preflop", type: "call", amount: 1.5, pot: 5 },
        { seatId: "hero", street: "flop", type: "bet", amount: 2.5, pot: 7.5, isHero: true },
        { seatId: "v1", street: "flop", type: "call", amount: 2.5, pot: 10 },
        { seatId: "hero", street: "turn", type: "bet", amount: 7, pot: 17, isHero: true },
        { seatId: "v1", street: "turn", type: "fold", amount: 0, pot: 17 },
      ],
      results: { heroWon: true },
    },
  ],
};

export const allFixtures = {
  disciplinedSessionFixture,
  loosePassiveFixture,
  recklessAdaptiveFixture,
  strongExploitFixture,
};
