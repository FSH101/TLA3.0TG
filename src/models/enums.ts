/**
 * Enumeration ported from TLAMK2 server _defines.fos.
 * These constants are used across the engine to mimic native AngelScript values.
 */
export enum SayType {
  Norm = 1,
  NormOnHead = 2,
  Shout = 3,
  ShoutOnHead = 4,
  Emote = 5,
  EmoteOnHead = 6,
  Whisp = 7,
  WhispOnHead = 8,
  Social = 9,
  Radio = 10,
  NetMsg = 11,
  Dialog = 12,
  Append = 13,
  EncounterAny = 14,
  EncounterRt = 15,
  EncounterTb = 16,
  FixResult = 17,
  DialogboxText = 18,
  DialogboxButtonStart = 19,
  DialogboxButtonEnd = 38,
  SayTitle = 39,
  SayText = 40,
  FlashWindow = 41,
  Server = 42,
  DialogBranch = 43,
  DialogAnswer = 44,
  DialogShow = 45,
  DialogLexem = 46,
  DialogHide = 47,
  Informer = 60,
}

export enum TextMessageType {
  Text = 0,
  Dialog = 1,
  Item = 2,
  Game = 3,
  GameMaster = 4,
  Combat = 5,
  Quest = 6,
  Holo = 7,
  Craft = 8,
  Internal = 9,
}

export enum CritterCondition {
  Life = 1,
  Knockout = 2,
  Dead = 3,
}

export enum Gender {
  Male = 0,
  Female = 1,
  It = 2,
}

export enum AccessoryType {
  None = 0,
  Critter = 1,
  Hex = 2,
  Container = 3,
  Erase = 45,
  CritterDropItem = 208,
}

export enum ItemType {
  None = 0,
  Armor = 1,
  Drug = 2,
  Weapon = 3,
  Ammo = 4,
  Misc = 5,
  Misc2 = 6,
  Key = 7,
  Container = 8,
  Door = 9,
  Grid = 10,
  Generic = 11,
  Wall = 12,
  Car = 13,
  Animal = 14,
}

export enum ItemFlag {
  Hidden = 0x00000001,
  Flat = 0x00000002,
  NoBlock = 0x00000004,
  ShootThru = 0x00000008,
  LightThru = 0x00000010,
  MultiHex = 0x00000020,
  WallTransEnd = 0x00000040,
  TwoHands = 0x00000080,
  BigGun = 0x00000100,
  AlwaysView = 0x00000200,
  HasTimer = 0x00000400,
  BadItem = 0x00000800,
  NoHighlight = 0x00001000,
  ShowAnim = 0x00002000,
  ShowAnimExt = 0x00004000,
  Light = 0x00008000,
  Geck = 0x00010000,
  Trap = 0x00020000,
  NoLightInfluence = 0x00040000,
  NoLoot = 0x00080000,
  NoSteal = 0x00100000,
  Gag = 0x00200000,
  Colorize = 0x00400000,
  ColorizeInv = 0x00800000,
  CanUseOnSomething = 0x01000000,
  CanLook = 0x02000000,
  CanTalk = 0x04000000,
  CanPickup = 0x08000000,
  CanUse = 0x10000000,
  Holodisk = 0x20000000,
  Radio = 0x40000000,
  Cached = 0x80000000,
}

export enum DamageType {
  Uncalled = 0,
  Normal = 1,
  Laser = 2,
  Fire = 3,
  Plasma = 4,
  Electric = 5,
  Emp = 6,
  Explode = 7,
}

export enum CritterEvent {
  Idle = 0,
  Finish = 1,
  Dead = 2,
  Respawn = 3,
  ShowCritter = 4,
  ShowCritter1 = 5,
  ShowCritter2 = 6,
  HideCritter = 8,
  HideCritter1 = 9,
  HideCritter2 = 10,
  ShowItemOnMap = 12,
  ChangeItemOnMap = 13,
  HideItemOnMap = 14,
  Attack = 15,
  Attacked = 16,
  Stealing = 17,
}
