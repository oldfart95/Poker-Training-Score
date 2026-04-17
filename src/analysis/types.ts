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

export type HandValidity = "valid" | "invalid_schema" | "invalid_sequence" | "invalid_accounting" | "unsupported";

export type ConfidenceLevel = "high" | "medium" | "low";

export type DecisionVerdict = "credit" | "good" | "questionable" | "mistake" | "neutral";

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
  schemaVersion?: string | number;
  session?: {
    id?: string;
    startedAt?: string;
    endedAt?: string | null;
    mode?: string;
    roomPolicy?: string;
    heroSeat?: number;
    [key: string]: unknown;
  };
  players?: RawSeat[];
  hands?: RawHand[];
  summary?: Record<string, unknown>;
  summaryStats?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RawHand {
  id?: string;
  handId?: string;
  handNumber?: number;
  buttonSeatId?: string;
  buttonSeat?: number;
  heroSeatId?: string;
  heroSeat?: number;
  board?: string[];
  activePlayersAtStart?: RawSeat[];
  startingStacks?: Record<string, number>;
  holeCards?: string[];
  heroHoleCards?: string[];
  seats?: RawSeat[];
  actions?: RawAction[];
  results?: Record<string, unknown>;
  result?: Record<string, unknown>;
  stacks?: Record<string, number>;
  summary?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RawSeat {
  id?: string;
  playerId?: string;
  seat?: number;
  name?: string;
  label?: string;
  position?: string;
  archetype?: string;
  stack?: number;
  hero?: boolean;
  isHero?: boolean;
  busted?: boolean;
  inactive?: boolean;
  [key: string]: unknown;
}

export interface RawAction {
  actorId?: string;
  seatId?: string;
  playerId?: string;
  actorSeat?: number;
  street?: string;
  action?: string;
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
  schemaVersion: string | null;
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
  busted: boolean;
  inactive: boolean;
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
  playerCount: number;
  stackDepthBb: number | null;
  preflopAggressor: string | null;
  facingBet: number;
  potOdds: number | null;
  spr: number | null;
  streetState: string;
  lineSummary: string;
  actionChain: string;
  resultLabel: string;
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

export interface RuleTrigger {
  id: string;
  label: string;
  category: CategoryKey;
  impact: number;
  outcome: "credit" | "caution" | "mistake";
  explanation: string;
}

export interface DecisionReview {
  actionIndex: number;
  street: Street;
  actionType: ActionType;
  heroAction: string;
  potBefore: number;
  facingBet: number;
  potOdds: number | null;
  spr: number | null;
  verdict: DecisionVerdict;
  scoreDelta: number;
  ruleTriggers: RuleTrigger[];
  summary: string;
}

export interface IntegrityIssue {
  code: string;
  severity: "error" | "warning";
  category: Exclude<HandValidity, "valid">;
  message: string;
  actionIndex?: number;
  street?: Street;
  field?: string;
}

export interface HandImportReport {
  handId: string;
  handNumber: number;
  status: HandValidity;
  issues: IntegrityIssue[];
  unsupportedFields: string[];
  exactBreakActionIndex: number | null;
  engineBugDetected: boolean;
  strategicallyScorable: boolean;
  analysisDisposition: "full" | "partial" | "skipped";
}

export interface SessionIntegrityReport {
  schemaVersion: string | null;
  sessionStatus: HandValidity;
  totalHands: number;
  validHands: number;
  invalidHands: number;
  unscoredHands: number;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  mainFailureSource: string;
  biggestEngineFaultCategory: string | null;
  unsupportedFields: string[];
  handReports: HandImportReport[];
}

export interface HandReview {
  handId: string;
  handNumber: number;
  validity: HandValidity;
  badge: "Valid" | "Invalid" | "Skipped" | "Low confidence";
  importReport: HandImportReport;
  score: number | null;
  grade: string | null;
  categoryScores: Record<CategoryKey, number> | null;
  triggeredRules: RuleTrigger[];
  decisionReviews: DecisionReview[];
  summary: string;
  conciseSummary: string;
  whatWasGood: string[];
  whatWasQuestionable: string[];
  highestLeverageMistake: string | null;
  result: string;
  volatility: number;
  context: HandContext | null;
  skippedReason: string | null;
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
  overallScore: number | null;
  overallGrade: string | null;
  confidence: ConfidenceLevel;
  confidenceLabel: string;
  quickSummary: string;
  categoryScores: Record<CategoryKey, number>;
  handReviews: HandReview[];
  recommendations: Recommendation[];
  sessionIntegrity: SessionIntegrityReport;
  engineIssues: HandImportReport[];
  overview: {
    totalHands: number;
    validHands: number;
    invalidHands: number;
    unscoredHands: number;
    aggregateChipResult: number;
    strategicallyScoredChipResult: number;
    biggestStrategicLeakCategory: string | null;
    biggestEngineFaultCategory: string | null;
    topReviewedDecisions: DecisionReview[];
    topCautionSpots: DecisionReview[];
  };
}

export interface ParseResult {
  session: Session;
  warnings: string[];
  integrity: SessionIntegrityReport;
}
