export type AnalysisMode = "sound_fundamentals" | "adaptive_pressure";

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";

export type PlayerPosition =
  | "utg"
  | "hj"
  | "co"
  | "btn"
  | "sb"
  | "bb"
  | "unknown";

export type Archetype =
  | "Nit"
  | "TAG"
  | "LAG"
  | "Calling Station"
  | "Maniac"
  | "Unknown";

export type ActionType =
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "all_in"
  | "post_blind"
  | "ante";

export type CategoryKey =
  | "preflopDiscipline"
  | "initiative"
  | "positionUse"
  | "archetypeAdjustment"
  | "sizing"
  | "valueShowdown"
  | "riskControl"
  | "coherence";

export interface RawSession {
  id?: string;
  sessionId?: string;
  createdAt?: string;
  roomPolicy?: string;
  mode?: string;
  philosophy?: string;
  heroSeatId?: string;
  heroId?: string;
  stakes?: string;
  hands?: RawHand[];
  summaryStats?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RawHand {
  id?: string;
  handNumber?: number;
  buttonSeatId?: string;
  board?: string[];
  holeCards?: string[];
  heroHoleCards?: string[];
  seats?: RawSeat[];
  actions?: RawAction[];
  results?: Record<string, unknown>;
  stacks?: Record<string, number>;
  summary?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RawSeat {
  id?: string;
  playerId?: string;
  name?: string;
  label?: string;
  position?: string;
  archetype?: string;
  stack?: number;
  hero?: boolean;
  isHero?: boolean;
  [key: string]: unknown;
}

export interface RawAction {
  actorId?: string;
  seatId?: string;
  playerId?: string;
  street?: string;
  type?: string;
  amount?: number;
  toAmount?: number;
  pot?: number;
  board?: string[];
  note?: string;
  isHero?: boolean;
  [key: string]: unknown;
}

export interface Session {
  id: string;
  createdAt: string | null;
  roomPolicy: string;
  sourceMode: string | null;
  heroSeatId: string | null;
  stakes: string | null;
  hands: Hand[];
  summaryStats: Record<string, unknown>;
}

export interface Hand {
  id: string;
  handNumber: number;
  heroSeatId: string | null;
  buttonSeatId: string | null;
  seats: Seat[];
  heroSeat: Seat | null;
  heroHoleCards: string[];
  actions: Action[];
  board: string[];
  results: Record<string, unknown>;
  stacks: Record<string, number>;
  summary: Record<string, unknown>;
}

export interface Seat {
  id: string;
  name: string;
  position: PlayerPosition;
  archetype: Archetype;
  stack: number | null;
  isHero: boolean;
}

export interface Action {
  actorId: string;
  street: Street;
  type: ActionType;
  amount: number;
  toAmount: number | null;
  pot: number | null;
  board: string[];
  note: string | null;
  isHero: boolean;
}

export interface ArchetypeProfile {
  name: Archetype;
  foldTendency: number;
  callTendency: number;
  bluffTendency: number;
  aggressionTendency: number;
  showdownTendency: number;
  elasticityVsPressure: number;
  valueOwningRisk: number;
  trapFrequency: number;
  description: string;
}

export interface BoardTexture {
  primary: "dry" | "semi_wet" | "wet";
  paired: boolean;
  monotone: boolean;
  highCardHeavy: boolean;
  lowConnected: boolean;
  dynamic: boolean;
}

export type PreflopBucket =
  | "premium_pair"
  | "strong_pair"
  | "small_pair"
  | "premium_broadway"
  | "strong_broadway"
  | "suited_ace"
  | "suited_connector"
  | "suited_gapper"
  | "weak_offsuit_broadway"
  | "weak_suited_trash"
  | "offsuit_trash";

export type PostflopBucket =
  | "air"
  | "weak_showdown"
  | "draw"
  | "combo_draw"
  | "top_pair_weak_kicker"
  | "top_pair_good_kicker"
  | "overpair"
  | "two_pair"
  | "set"
  | "straight"
  | "flush"
  | "strong_made_hand"
  | "near_nut_hand";

export interface HandContext {
  hand: Hand;
  villains: Seat[];
  heroPosition: PlayerPosition;
  heroPreflopBucket: PreflopBucket;
  finalBoard: string[];
  boardTexture: BoardTexture;
  postflopBucket: PostflopBucket;
  potSizeEstimate: number;
  heroInvested: number;
  heroAggressiveActions: number;
  heroPassiveActions: number;
  villainAggressionFaced: number;
  effectiveStack: number | null;
  heroWentToShowdown: boolean;
  heroWon: boolean | null;
  dominantVillainArchetype: ArchetypeProfile;
  targetedVillainArchetypes: ArchetypeProfile[];
  lineSummary: string;
  flags: {
    openedPreflop: boolean;
    coldCalledPreflop: boolean;
    threeBet: boolean;
    isolatedLimpers: boolean;
    barreledMultipleStreets: boolean;
    shoved: boolean;
    facedStickyTarget: boolean;
    facedOverfolder: boolean;
    actedInPositionMostPostflop: boolean;
  };
}

export interface ScoreImpact {
  category: CategoryKey;
  delta: number;
  tags?: string[];
  warnings?: string[];
  severeLeaks?: string[];
  rationale: string;
}

export interface HandReview {
  handId: string;
  handNumber: number;
  score: number;
  grade: string;
  categoryScores: Record<CategoryKey, number>;
  positiveTags: string[];
  warningTags: string[];
  severeLeakTags: string[];
  rationales: string[];
  summary: string;
  volatility: number;
  context: HandContext;
}

export interface PatternSummary {
  tag: string;
  severity: "low" | "medium" | "high";
  count: number;
  affectedHands: number[];
  explanation: string;
  correction?: string;
}

export interface Recommendation {
  key: string;
  priority: "high" | "medium" | "low";
  text: string;
  sourceTags: string[];
}

export interface SessionReport {
  session: Session;
  mode: AnalysisMode;
  overallScore: number;
  overallGrade: string;
  quickSummary: string;
  categoryScores: Record<CategoryKey, number>;
  handReviews: HandReview[];
  leaks: PatternSummary[];
  strengths: PatternSummary[];
  recommendations: Recommendation[];
  overview: {
    totalHands: number;
    biggestStrength: PatternSummary | null;
    biggestLeak: PatternSummary | null;
    topRecurringIssue: PatternSummary | null;
    topRecurringPositive: PatternSummary | null;
  };
  topHands: {
    best: HandReview[];
    worst: HandReview[];
    weirdest: HandReview[];
  };
}
