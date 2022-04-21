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
