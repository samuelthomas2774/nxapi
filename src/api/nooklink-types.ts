export interface WebServiceError {
    code: string;
}

/** GET /sd/v1/users */
export interface Users {
    users: {
        id: string;
        name: string;
        image: string;
        land: {
            id: string;
            name: string;
            displayId: number;
        };
    }[];
}

/** POST /sd/v1/auth_token */
export interface AuthToken {
    token: string;
    expireAt: number;
}

/** GET /sd/v1/users/{userId}/profile?language=en-GB */
export interface UserProfile {
    mVer: number;
    mLanguage: string;
    mPNm: string;
    mBirth: {
        month: number;
        day: number;
    };
    mHandleName: string;
    mComment: null;
    mIsLandMaster: boolean;
    /** Date the user was registered on the island */
    mTimeStamp: {
        year: number;
        month: number;
        day: number;
    };
    mMyDesignAuthorId: string;
    mDreamAddress: string;
    mResortPlannerId: string;
    mJpeg: string;
    contentId: string;
    digest: string;
    createdAt: number;
    landName: string;
}

/** GET /sd/v1/lands/{landId}/profile?language=en-GB */
export interface IslandProfile {
    mVer: number;
    mLanguage: string;
    mVRuby: number;
    mVNm: string;
    mFruit: {
        id: number;
        name: string;
    };
    mNormalNpc: IslandProfileNpc[];
    mVillager: IslandProfileUser[];
}

interface IslandProfileNpc {
    name: string;
    image: string;
    birthMonth: number;
    birthDay: number;
}
interface IslandProfileUser {
    mPNm: string;
    mJpeg: string;
    mBirthMonth: number;
    mBirthDay: number;
    mIsLandMaster: boolean;
    /** Only exists for users with NookLink enabled */
    userId?: string;
}

/** GET /sd/v1/friends */
export interface Friends {
    friends: unknown[];
}

/** GET /sd/v1/friends/presences */
export interface FriendsPresences {
    presences: unknown[];
}

/** GET /sd/v1/emoticons */
export interface Emoticons {
    language: string;
    emoticons: Reaction[];
}

export interface Reaction {
    label: string;
    name: string;
    url: string;
}

/** GET /sd/v1/newspapers */
export interface Newspapers {
    newspapers: NewspaperItem[];
    isNewspaperDeleted: boolean;
    isBestNewsGenerated: boolean;
}

interface NewspaperItem {
    type: 'normal';
    findKey: string;
    beginDate: string;
    endDate: string;
}

/** GET /sd/v1/newspapers/{key} */
export interface Newspaper {
    user: {
        id: string;
        name: string;
        gender: 'M' | 'F';
        image: string;
    };
    land: {
        id: string;
        name: string;
        displayId: number;
    };
    findKey: string;
    body: {
        landId: string;
        type: 'normal';
        layout: number;
        articles: NewspaperArticle[];
        mainArticleIndexes: number[];
        nookNews: NewspaperNookNews[];
        stockLog: {
            beginDate: string;
            values: number[];
            version: number;
        };
    };
}

interface NewspaperArticle {
    date: string;
    label: NewspaperArticleLabel;
    priority: number;
    attributes: NewspaperAttribute[];
}
enum NewspaperArticleLabel {
    ACHIEVEMENT_PLAYDAYS_3 = 'Achievement_PlayDays_3',
    ACHIEVEMENT_PLAYDAYS_20 = 'Achievement_PlayDays_20',
    ACHIEVEMENT_PLAYDAYS_50 = 'Achievement_PlayDays_50',
    ACHIEVEMENT_PLAYDAYS_100 = 'Achievement_PlayDays_100',
    CATCHFISHFES_1 = 'CatchFishFes-1',
    CATCHFISHFES_2 = 'CatchFishFes-2',
    CHANGEEQUIP_1 = 'ChangeEquip-1',
    CHANGEEQUIP_2 = 'ChangeEquip-2',
    EASTER_2 = 'Easter-2',
    GETCHERRYBLOSSOMPETAL_MAINFIELD = 'GetCherryBlossomPetal_MainField',
    GETCRYSTALOFSNOW_MAINFIELD = 'GetCrystalOfSnow_MainField',
    GOTO_KAPPEITOUR_FEW = 'Goto_KappeiTour_few',
    GST_2 = 'Gst-2',
    GULA_2 = 'GulA-2',
    GULB_2 = 'GulB-2',
    HGC_CHECK_1 = 'Hgc_Check-1',
    HGC_CHECK_2 = 'Hgc_Check-2',
    LE_BRIDGEBUILT = 'LE_BridgeBuilt',
    LE_BRIDGEBUILT_FIRST = 'LE_BridgeBuilt_First',
    LE_FACILITYBUILT_CAFE = 'LE_FacilityBuilt_Cafe',
    LE_FACILITYBUILT_CAMPSITE = 'LE_FacilityBuilt_Campsite',
    LE_FACILITYBUILT_MARKET = 'LE_FacilityBuilt_Market',
    LE_FACILITYBUILT_MARKET2 = 'LE_FacilityBuilt_Market2',
    LE_FACILITYBUILT_MUSUEM_NEW = 'LE_FacilityBuilt_Museum_New',
    LE_FACILITYBUILT_MUSUEMTENT = 'LE_FacilityBuilt_MuseumTent',
    LE_FACILITYBUILT_TAILOR = 'LE_FacilityBuilt_Tailor',
    LE_FACILITYBUILT_TOWNOFFICE = 'LE_FacilityBuilt_TownOffice',
    LE_MUSEUMCOMPLETE_FOSSIL = 'LE_MuseumComplete_Fossil',
    LE_NEWPLAYERVILLAGER = 'LE_NewPlayerVillager',
    LE_NNPCHOUSEBuilt = 'LE_NnpcHouseBuilt',
    LE_NNPCHOUSEMOVEIN = 'LE_NnpcHouseMoveIn',
    LE_PLAYERVILLAGER_HOUSEBUILT = 'LE_PlayerVillager_HouseBuilt',
    LE_PLAYERVILLAGER_HOUSEEXPAND = 'LE_PlayerVillager_HouseExpand',
    LE_PLAYERVILLAGER_HOUSEMOVE = 'LE_PlayerVillager_HouseMove',
    LE_SLOPEBUILT_FIRST = 'LE_SlopeBuilt_First',
    LE_TKKLIVEFIRST = 'LE_TkkLiveFirst',
    LE_TKKLIVENORMAL = 'LE_TkkLiveNormal',
    LE_TODAYIS_PLAYERBIRTHDAY = 'LE_TodayIs_PlayerBirthday',
    LE_WRITEBBS = 'LE_WriteBBS',
    MAMOUNTMARKETBUY_FEW = 'mAmountMarketBuy_few',
    MAMOUNTMARKETBUY_MANY = 'mAmountMarketBuy_many',
    MAMOUNTMARKETSELL = 'mAmountMarketSell',
    MAMOUNTTAILORBUY_FEW = 'mAmountTailorBuy_few',
    MAMOUNTTAILORBUY_MANY = 'mAmountTailorBuy_many',
    MBUYSTOCK = 'mBuyStock',
    MGETMILEPOINT = 'mGetMilePoint',
    PE_CATALOGORDER_NEW = 'PE_CatalogOrder_New',
    PE_DIVINGFIRST = 'PE_DivingFirst',
    PE_DIY_NEW = 'PE_DIY_New',
    PE_GETFISH_HIGHPRICE = 'PE_GetFish_HighPrice',
    PE_GETFISH_NEW = 'PE_GetFish_New',
    PE_GETINSECT_HIGHPRICE = 'PE_GetInsect_HighPrice',
    PE_GETINSECT_NEW = 'PE_GetInsect_New',
    PE_GETSEAFOOD_HIGHPRICE = 'PE_GetSeafood_HighPrice',
    PE_GETSEAFOOD_NEW = 'PE_GetSeafood_New',
    PE_GOTO_COMMUNEISLAND = 'PE_Goto_CommuneIsland',
    PE_GOTO_MYSTERYTOUR_FEW = 'PE_Goto_MysteryTour_few',
    PE_LANDEVALUATION_UP = 'PE_LandEvaluation_Up',
    PE_LOAN_FULLPAYMENT = 'PE_Loan_FullPayment',
    PE_MAKESNOWMAN_HIGH = 'PE_MakeSnowman-high',
    PE_MAKESNOWMAN_LOW = 'PE_MakeSnowman-low',
    PE_MUSEUMDONATION = 'PE_MuseumDonation',
    PE_NNPC_CAMPSITETALK = 'PE_NNPC_CampSiteTalk',
    PE_NNPC_PLAYWITH = 'PE_NNPC_PlayWith',
    PE_NNPC_SOLVEREQUEST = 'PE_NNPC_SolveRequest',
    PE_PRESENT_FROMNNPC = 'PE_Present_FromNNPC',
    PE_PRESENT_FROMNNPC_RECIPE = 'PE_Present_FromNNPC_Recipe',
    PE_PRESENT_TONNPC = 'PE_Present_ToNNPC',
    PE_REMAKE_BYDIY = 'PE_Remake_ByDIY',
    PE_SHAREPLAY = 'PE_SharePlay',
    PE_TODAYISMYBIRTHDAY_2 = 'PE_TodayIsMyBirthday-2',
    PLANTFLOWERSEED_MAINFIELD = 'PlantFlowerSeed_MainField',
    PLANTFRUIT_FIRST_MAINFIELD = 'PlantFruit_First_MainField',
    PLANTSHRUBSEEDLINGS_MAINFIELD = 'PlantShrubSeedlings_MainField',
    PLANTTREESEEDLINGS_MAINFIELD = 'PlantTreeSeedlings_MainField',
    PLANTVEGETABLESEEDLINGS_MAINFIELD = 'PlantVegetableSeedlings_MainField',
    PV_CAFE_DRINKCOFFEE = 'PV_Cafe_DrinkCoffee',
    PV_CHANGEEQUIP_BYDRESSOR = 'PV_ChangeEquip_ByDressor',
    PV_CONSTRUCTCLIFF_FEW = 'PV_ConstructCliff_few',
    PV_CONSTRUCTCLIFF_MANY = 'PV_ConstructCliff_many',
    PV_CONSTRUCTRIVER_MANY = 'PV_ConstructRiver_many',
    PV_CONSTRUCTROAD_MANY = 'PV_ConstructRoad_many',
    PV_CREATEMYDESIGNNORMAL = 'PV_CreateMydesignNormal',
    PV_ENTERDREAMLAND = 'PV_EnterDreamLand',
    PV_EXCAVATEDFOSSIL = 'PV_ExcavatedFossil',
    PV_RADIOGYM_JOIN = 'PV_RadioGym_Join',
    PV_TAKEPHOTO = 'PV_TakePhoto',
    SEO_2 = 'Seo-2',
    SEO_2_RECIPE = 'Seo-2_Recipe',
    TALKNNPC_1 = 'TalkNnpc-1',
    TALKNNPC_2 = 'TalkNnpc-2',
    WISHSHOOTINGSTAR_MAINFIELD = 'WishShootingStar_MainField',
}
interface NewspaperNookNews {
    date: string;
    label: NewspaperNookNewsLabel;
    attributes: NewspaperAttribute[];
}
enum NewspaperNookNewsLabel {
    APRILFOOL_F = 'AprilFool_F',
    APRILFOOL_P = 'AprilFool_P',
    BIGGAME_F = 'BigGame_F',
    BIGGAME_P = 'BigGame_P',
    CHERRYBLOSSOMPETAL_F = 'CherryBlossomPetal_F',
    CHILDDAY_F = 'ChildDay_F',
    CRYSTALOFSNOW_P = 'CrystalOfSnow_P',
    EARTHDAY_F = 'EarthDay_F',
    EARTHDAY_P = 'EarthDay_P',
    EASTER = 'Easter',
    GROUNDHOGDAY_F = 'GroundhogDay_F',
    GROUNDHOGDAY_P = 'GroundhogDay_P',
    ITEM_CARNIVAL_P = 'Item_Carnival_P',
    ITEM_EASTER_P = 'Item_Easter_P',
    ITEM_WINTER_P = 'Item_Winter_P',
    LUNARNEWYEARASIA_F = 'LunarNewYearAsia_F',
    LUNARNEWYEARASIA_P = 'LunarNewYearAsia_P',
    NANAKUSAGAYU_F = 'Nanakusagayu_F',
    NEWYEARDAY_P = 'NewYearDay_P',
    ORNAMENT_P = 'Ornament_P',
    PIDAY_P = 'PiDay_P',
    PLANTINGDAY_F = 'PlantingDay_F',
    PROM_F = 'Prom_F',
    PROM_P = 'Prom_P',
    SETSUBUN_F = 'Setsubun_F',
    SETSUBUN_P = 'Setsubun_P',
    SHAMROCKDAY_F = 'ShamrockDay_F',
    SHAMROCKDAY_P = 'ShamrockDay_P',
    VALENTINE_F = 'Valentine_F',
    VALENTINE_P = 'Valentine_P',
    VENICECARNIVAL_F = 'VeniceCarnival_F',
    VENICECARNIVAL_P = 'VeniceCarnival_P',
    WAKATAKE_P = 'Wakatake_P',
}

type NewspaperAttribute =
    NewspaperAttributeDate |
    NewspaperAttributeNpc |
    NewspaperAttributeItem |
    NewspaperAttributeRandom |
    NewspaperAttributePlayer |
    NewspaperAttributeValue;

interface NewspaperAttributeDate {
    type: 'date';
    value: string;
}
interface NewspaperAttributeNpc {
    type: 'npc';
    value: string;
    grammar: {
        Gender: 'M' | 'F';
    };
    image: string;
}
interface NewspaperAttributeItem {
    type: 'item';
    value: string;
    grammar: {
        IndefArticle?: string;
        DefArticle?: string;
    };
    image: string;
}
interface NewspaperAttributeRandom {
    type: 'rand';
    value: number;
}
interface NewspaperAttributePlayer {
    type: 'player';
    value: string;
    grammar: {
        Gender: 'M' | 'F';
    };
    image: string;
}
interface NewspaperAttributeValue {
    type: 'value';
    value: number;
}

/** GET /sd/v1/catalog_items?language={language}&current_year={year} */
export interface Catalog {
    updated_at: number;
    items: CatalogItem[];
    is_open_and_enter_remake_shop: boolean;
    is_unlock_fence_remake: boolean;
    is_unlock_regulation: boolean;
}

interface CatalogItem {
    unique_id: number;
    label: string;
    kind_id: CatalogItemKind;
    price: number;
    catalog_type: CatalogItemCatalogType;
    item_Size_id: CatalogItemSize;
    ui_category: CatalogItemUiCategory;
    icon?: string;
    item_fossil_set_id: number;
    hha_theme: number;
    can_sell: number;
    remakable: boolean;
    color1?: CatalogItemColor;
    color2?: CatalogItemColor;
    refabric_pattern0_color0?: CatalogItemColor;
    refabric_pattern0_color1?: CatalogItemColor;
    rebody_pattern?: CatalogItemPattern[];
    variations?: CatalogItemVariant[];
    fashion_theme?: CatalogItemFashionTheme[];
    from: string;
    shop_remakable: boolean;
    small_genre: CatalogItemSmallGenre;
    is_tool_category: boolean;
    region_event?: CatalogItemEvent;
}
interface CatalogItemPattern {
    index: number;
    name: string;
    color0: CatalogItemColor;
    color1: CatalogItemColor;
    icon: string;
}
interface CatalogItemVariant {
    unique_id: number;
    name: string;
    color1: CatalogItemColor;
    color2: CatalogItemColor;
    icon: string;
}
interface CatalogItemEvent {
    name: string;
    period: CatalogItemEventPeriod[];
    countries: CatalogItemEventCountry[];
}
interface CatalogItemEventPeriod {
    begin: string;
    end: string;
}
interface CatalogItemEventCountry {
    country_code: CatalogItemEventCountryCode;
    country?: string;
    flag?: string;
}
enum CatalogItemKind {
    Money = "Money",
    Ftr = "Ftr",
    Tops = "Tops",
    OnePiece = "OnePiece",
    MarineSuit = "MarineSuit",
    Bottoms = "Bottoms",
    Socks = "Socks",
    Shoes = "Shoes",
    Cap = "Cap",
    Accessory = "Accessory",
    Axe = "Axe",
    Net = "Net",
    FishingRod = "FishingRod",
    Shovel = "Shovel",
    Slingshot = "Slingshot",
    Watering = "Watering",
    Timer = "Timer",
    FireworkM = "FireworkM",
    Umbrella = "Umbrella",
    PartyPopper = "PartyPopper",
    Insect = "Insect",
    Feather = "Feather",
    SnowCrystal = "SnowCrystal",
    Fish = "Fish",
    DiveFish = "DiveFish",
    Fossil = "Fossil",
    Gyroid = "Gyroid",
    Music = "Music",
    Fruit = "Fruit",
    FlowerSeed = "FlowerSeed",
    Turnip = "Turnip",
    ShellDrift = "ShellDrift",
    Trash = "Trash",
    Mushroom = "Mushroom",
    Flower = "Flower",
    Ore = "Ore",
    Medicine = "Medicine",
    LostQuest = "LostQuest",
    LostQuestDust = "LostQuestDust",
    Candy = "Candy",
    Picture = "Picture",
    Sculpture = "Sculpture",
    HousePost = "HousePost",
    EasterEgg = "EasterEgg",
    TopsDefault = "TopsDefault",
    BottomsDefault = "BottomsDefault",
    None = "None",
    Bag = "Bag",
    JohnnyQuest = "JohnnyQuest",
    JohnnyQuestDust = "JohnnyQuestDust",
    ChangeStick = "ChangeStick",
    GroundMaker = "GroundMaker",
    CliffMaker = "CliffMaker",
    Ladder = "Ladder",
    Dishes = "Dishes",
    Honeycomb = "Honeycomb",
    Tree = "Tree",
    TreeSeedling = "TreeSeedling",
    Bush = "Bush",
    BushSeedling = "BushSeedling",
    Vegetable = "Vegetable",
    VegeSeedling = "VegeSeedling",
    FlowerBud = "FlowerBud",
    TurnipExpired = "TurnipExpired",
    CraftMaterial = "CraftMaterial",
    CraftRemake = "CraftRemake",
    Rug = "Rug",
    FossilUnknown = "FossilUnknown",
    PitFallSeed = "PitFallSeed",
    TreasureQuest = "TreasureQuest",
    TreasureQuestDust = "TreasureQuestDust",
    MyDesignTexture = "MyDesignTexture",
    ShellFish = "ShellFish",
    XmasDeco = "XmasDeco",
    PictureFake = "PictureFake",
    SculptureFake = "SculptureFake",
    Weed = "Weed",
    DummyRecipe = "DummyRecipe",
    Helmet = "Helmet",
    DoorDeco = "DoorDeco",
    Fence = "Fence",
    HousingKit = "HousingKit",
    BdayCupcake = "BdayCupcake",
    VegeTree = "VegeTree",
    PinataStick = "PinataStick",
    SequenceOnly = "SequenceOnly",
    NpcOutfit = "NpcOutfit",
    RiverMaker = "RiverMaker",
    DummyFtr = "DummyFtr",
    QuestWrapping = "QuestWrapping",
    Giftbox = "Giftbox",
    MyDesignObject = "MyDesignObject",
    DummyWrapping = "DummyWrapping",
    DummyPresentbox = "DummyPresentbox",
    FishBait = "FishBait",
    Bromide = "Bromide",
    DummyCardboard = "DummyCardboard",
    YutaroWisp = "YutaroWisp",
    WoodenStickTool = "WoodenStickTool",
    FierworkHand = "FierworkHand",
    StickLight = "StickLight",
    Uchiwa = "Uchiwa",
    Windmill = "Windmill",
    BlowBubble = "BlowBubble",
    Partyhorn = "Partyhorn",
    Ocarina = "Ocarina",
    Panflute = "Panflute",
    Tambourine = "Tambourine",
    Balloon = "Balloon",
    RoomWall = "RoomWall",
    RoomFloor = "RoomFloor",
    SmartPhone = "SmartPhone",
    SlopeItem = "SlopeItem",
    BridgeItem = "BridgeItem",
    EventObjFtr = "EventObjFtr",
    NnpcRoomMarker = "NnpcRoomMarker",
    MessageBottle = "MessageBottle",
    DIYRecipe = "DIYRecipe",
    MusicMiss = "MusicMiss",
    HousingKitRcoQuest = "HousingKitRcoQuest",
    MilePlaneTicket = "MilePlaneTicket",
    Sakurapetal = "Sakurapetal",
    TailorTicket = "TailorTicket",
    StarPiece = "StarPiece",
    PlayerDemoOutfit = "PlayerDemoOutfit",
    HousingKitBirdge = "HousingKitBirdge",
    AutumnLeaf = "AutumnLeaf",
    WrappingPaper = "WrappingPaper",
    PhotoStudioList = "PhotoStudioList",
    CraftPhoneCase = "CraftPhoneCase",
    LicenseItem = "LicenseItem",
    RugMyDesign = "RugMyDesign",
    DummyDIYRecipe = "DummyDIYRecipe",
    DummyHowtoBook = "DummyHowtoBook",
    RollanTicket = "RollanTicket",
    Poster = "Poster",
    FishToy = "FishToy",
    InsectToy = "InsectToy",
    LoveCrystal = "LoveCrystal",
    Vine = "Vine",
    SettingLadder = "SettingLadder",
    SincerityTowel = "SincerityTowel",
    FtrWall = "FtrWall",
    OneRoomBox = "OneRoomBox",
    SouvenirChocolate = "SouvenirChocolate",
    PirateQuest = "PirateQuest",
    HandheldPennant = "HandheldPennant",
    ShopTorso = "ShopTorso",
    Counter = "Counter",
    Pillar = "Pillar",
    HarvestDish = "HarvestDish",
    QuestChristmasPresentbox = "QuestChristmasPresentbox",
    BigbagPresent = "BigbagPresent",
    JuiceFuzzyapple = "JuiceFuzzyapple",
    SoySet = "SoySet",
    Megaphone = "Megaphone",
    RainbowFeather = "RainbowFeather",
    MaracasCarnival = "MaracasCarnival",
    Otoshidama = "Otoshidama",
    DummyWrappingOtoshidama = "DummyWrappingOtoshidama",
    GardenEditList = "GardenEditList",
    FlowerShower = "FlowerShower",
    GyroidScrap = "GyroidScrap",
    CookingMaterial = "CookingMaterial",
    Drink = "Drink",
    CommonFabricRug = "CommonFabricRug",
    CommonFabricObject = "CommonFabricObject",
    CommonFabricTexture = "CommonFabricTexture",
    SubToolGeneric = "SubToolGeneric",
    SubToolRemakeable = "SubToolRemakeable",
    SubToolEat = "SubToolEat",
    SubToolEatDrop = "SubToolEatDrop",
    SubToolEatRemakeable = "SubToolEatRemakeable",
    StickLightColorful = "StickLightColorful",
    Lantern = "Lantern",
    Basket = "Basket",
    HandBag = "HandBag",
    Icecandy = "Icecandy",
    Candyfloss = "Candyfloss",
    Tapioca = "Tapioca",
    SubToolSensu = "SubToolSensu",
    SubToolCan = "SubToolCan",
    SubToolIcecream = "SubToolIcecream",
    SubToolIcesoft = "SubToolIcesoft",
    SubToolDonut = "SubToolDonut",
    WeedLight = "WeedLight"
}
enum CatalogItemCatalogType {
    Sale = "Sale",
    NotForSale = "NotForSale",
    NotSee = "NotSee"
}
enum CatalogItemSize {
    Size_0_5x0_5 = "0.5x0.5",
    Size_0_5x1 = "0.5x1",
    Size_1x0_5 = "1x0.5",
    Size_1x1 = "1x1",
    Size_1x1_5 = "1x1.5",
    Size_1x2 = "1x2",
    Size_1_5x1_5 = "1.5x1.5",
    Size_2x0_5 = "2x0.5",
    Size_2x1 = "2x1",
    Size_2x1_5 = "2x1.5",
    Size_2x2 = "2x2",
    Size_3x0_5 = "3x0.5",
    Size_3x1 = "3x1",
    Size_3x2 = "3x2",
    Size_3x3 = "3x3",
    Size_4x3 = "4x3",
    Size_4x4 = "4x4",
    Size_5x4 = "5x4",
    Size_5x5 = "5x5"
}
enum CatalogItemUiCategory {
    None = "None",
    Floor = "Floor",
    Upper = "Upper",
    Wall = "Wall",
    Ceiling = "Ceiling",
    Unnecessary = "Unnecessary",
    RoomWall = "RoomWall",
    RoomFloor = "RoomFloor",
    Ceiling_Rug = "Ceiling_Rug",
    Food = "Food",
    Desert = "Desert",
    Clothes = "Clothes",
    Creature = "Creature",
    Tool = "Tool",
    Others = "Others"
}
enum CatalogItemSmallGenre {
    None = "None",
    Bed = "Bed",
    Chair = "Chair",
    Table = "Table",
    Lamp = "Lamp",
    Bathroom = "Bathroom",
    FacilityGoods = "FacilityGoods",
    MusicalInstrument = "MusicalInstrument",
    PlantItem = "PlantItem",
    Kitchen = "Kitchen",
    EntertainmentAppliances = "EntertainmentAppliances",
    AirConditioning = "AirConditioning",
    HobbyGoods = "HobbyGoods",
    Shelf = "Shelf",
    EventGoods = "EventGoods",
    NationalGoods = "NationalGoods",
    Art = "Art",
    WallHanging = "WallHanging",
    WorkBench = "WorkBench",
    OutdoorGoods = "OutdoorGoods",
    GardeningGoods = "GardeningGoods",
    ScreenArch = "ScreenArch",
    FloorIndoor = "FloorIndoor",
    FloorOutdoor = "FloorOutdoor",
    WallNormal = "WallNormal",
    WallSpecial = "WallSpecial",
    RugRound = "RugRound",
    RugQuadrilateral = "RugQuadrilateral",
    RugSpecial = "RugSpecial",
    Bromide = "Bromide",
    Poster = "Poster",
    Tree = "Tree",
    Bush = "Bush",
    Flower = "Flower",
    WeedStone = "WeedStone",
    Vegetable = "Vegetable",
    Cap = "Cap",
    Accessory = "Accessory",
    Tops = "Tops",
    OnePiece = "OnePiece",
    Bottoms = "Bottoms",
    Socks = "Socks",
    Shoes = "Shoes",
    Bag = "Bag",
    Insect = "Insect",
    Fish = "Fish",
    DiveFish = "DiveFish",
    BuildingMaterial = "BuildingMaterial",
    Tool = "Tool",
    Plants = "Plants",
    Fossil = "Fossil",
    Music = "Music",
    Others = "Others",
    Umbrella = "Umbrella",
    MarineSuit = "MarineSuit",
    DishFood = "DishFood",
    DishDrink = "DishDrink",
    CeilingEtc = "CeilingEtc",
    CeilingLamp = "CeilingLamp",
    Haniwa = "Haniwa"
}
enum CatalogItemColor {
    None = "None",
    Red = "Red",
    Green = "Green",
    Blue = "Blue",
    Yellow = "Yellow",
    Orange = "Orange",
    Pink = "Pink",
    Purple = "Purple",
    LightBlue = "LightBlue",
    Beige = "Beige",
    Brown = "Brown",
    Gray = "Gray",
    White = "White",
    Black = "Black",
    Colorful = "Colorful"
}
enum CatalogItemFashionTheme {
    Daily = "daily",
    Fairyland = "fairyland",
    Fomal = "fomal",
    Horror = "horror",
    Outdoor = "outdoor",
    Party = "party",
    Relax = "relax",
    Sport = "sport",
    Stage = "stage",
    Vacation = "vacation",
    Work = "work"
}
enum CatalogItemEventCountryCode {
    None = "None",
    America = "America",
    Mexico = "Mexico",
    Brazil = "Brazil",
    China = "China",
    Korea = "Korea",
    Japan = "Japan",
    Russia = "Russia",
    France = "France",
    Spain = "Spain",
    Italy = "Italy",
    Germany = "Germany",
    Asia = "Asia",
    Europe = "Europe",
    EachCountry = "EachCountry",
    World = "World",
    Northern = "Northern",
    Southern = "Southern",
    GreaterChina = "GreaterChina",
    Taiwan = "Taiwan"
}