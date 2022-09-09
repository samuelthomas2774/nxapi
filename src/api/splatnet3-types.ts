/** /bullet_tokens */
export interface BulletToken {
    bulletToken: string;
    lang: string;
    is_noe_country: 'true' | unknown;
    // ...
}

/** /graphql */
export interface GraphQLRequest<Variables extends unknown> {
    variables: Variables;
    extensions: {
        persistedQuery: {
            version: 1;
            sha256Hash: RequestParameters['id'];
        };
    };
}

export interface RequestParameters {
    id: string;
    // ...
}

export interface GraphQLResponse<T = unknown> {
    data: T;
}

export enum RequestId {
    SupportButton_SupportChallengeMutation = '30aa261475d43bd765b4200fc67003c8',
    CheckinWithQRCodeMutation = '8e3fecf7cfce83f6831b17e9052791d0',
    CoopPagerLatestCoopQuery = '82385ab3c3444c857bd35a8d87dbc700',
    VotesUpdateFestVoteMutation = 'a2c742c840718f37488e0394cd6e1e08',
    CreateMyOutfitMutation = '31ff008ea218ffbe11d958a52c6f959f',
    UpdateMyOutfitMutation = 'bb809066282e7d659d3b9e9d4e46b43b',
    DownloadSearchReplayQuery = 'b461048f9ffc414b3967a3cdad0805dd',
    ReplayModalReserveReplayDownloadMutation = '87bff2b854168b496c2da8c0e7f3e5bc',
    PagerLatestVsDetailQuery = '0329c535a32f914fd44251be1f489e24',
    PagerUpdateBattleHistoriesByVsModeQuery = '67224c25f7b2e605205d152009f593c9',
    ConfigureAnalyticsQuery = 'f8ae00773cc412a50dd41a6d9a159ddd',
    CurrentFestQuery = 'c0429fd738d829445e994d3370999764',
    BankaraBattleHistoriesQuery = 'c1553ac75de0a3ea497cdbafaa93e95b',
    BankaraBattleHistoriesRefetchQuery = 'd8a8662345593bbbcd63841c91d4c6f5',
    LatestBattleHistoriesQuery = '7d8b560e31617e981cf7c8aa1ca13a00',
    LatestBattleHistoriesRefetchQuery = '80585ad4e4ecb674c3d8cd278adb1d21',
    PrivateBattleHistoriesQuery = '51981299595060692440e0ca66c475a1',
    PrivateBattleHistoriesRefetchQuery = '9ef974f2686a88f24e0dbff6f63a83c4',
    RegularBattleHistoriesQuery = '819b680b0c7962b6f7dc2a777cd8c5e4',
    RegularBattleHistoriesRefetchQuery = 'fed6e752513a9986177e8eec50dfdd3c',
    BattleHistoryCurrentPlayerQuery = '49dd00428fb8e9b4dde62f585c8de1e0',
    ChallengeQuery = '8a079214500148bf88a8fce1d7209b90',
    ChallengeRefetchQuery = '34aedc79f96b8613501bba465295f779',
    JourneyChallengeDetailQuery = '38e58b84376a2ad49ddbe4061b948455',
    JourneyChallengeDetailRefetchQuery = '8dc246933b1f4e26a6dfd251878cf786',
    JourneyQuery = 'bc71fc0264f3f72256724b069f7a4097',
    JourneyRefetchQuery = '09eee118fa16415d6bc3846bc6e5d8e5',
    CheckinQuery = 'af8cac2c2554e22e2bbada19392083a2',
    CoopHistoryDetailQuery = 'f3799a033f0a7ad4b1b396f9a3bafb1e',
    CoopHistoryDetailRefetchQuery = 'd3188df2fd4436870936b109675e2849',
    CoopHistoryQuery = '817618ce39bcf5570f52a97d73301b30',
    RefetchableCoopHistory_CoopResultQuery = 'a5692cf290ffb26f14f0f7b6e5023b07',
    DetailFestRecordDetailQuery = '2d661988c055d843b3be290f04fb0db9',
    DetailFestRefethQuery = '0eb7bac3d8aabcad0e9d663ee5b90846',
    DetailFestVotingStatusRefethQuery = '92f51ed1ab462bbf1ab64cad49d36f79',
    DetailRankingQuery = '58bdd28e3cf71c3bf38bc45836ee1e96',
    DetailVotingStatusQuery = '53ee6b6e2acc3859bf42454266d671fc',
    FestRecordQuery = '44c76790b68ca0f3da87f2a3452de986',
    FestRecordRefetchQuery = '73b9837d0e4dd29bfa2f1a7d7ee0814a',
    FriendListQuery = '7a0e05c28c7d3f7e5a06def87ab8cd2d',
    FriendListRefetchQuery = 'c1afed6111887347e244c639e7d35c69',
    GesotownQuery = 'd08dbdd29f31471e61daa978feea697a',
    GesotownRefetchQuery = 'c61bf8a7f7bc47393b8c0e7590ae11f4',
    SaleGearDetailOrderGesotownGearMutation = 'aebd822b4a4e48dc48f618411054b8f5',
    SaleGearDetailQuery = '7c4173bb0f5d56f29dbec889173cff24',
    HeroHistoryQuery = 'fbee1a882371d4e3becec345636d7d1c',
    HeroHistoryRefetchQuery = '4f9ae2b8f1d209a5f20302111b28f975',
    HistoryRecordQuery = '29957cf5d57b893934de857317cd46d8',
    HistoryRecordRefetchQuery = '5e1d0bb4b52e2a99049df6e17117f363',
    MyOutfitDetailQuery = 'd935d9e9ba7a5b6b5d6ece7f253304fc',
    MyOutfitsQuery = '81d9a6849467d2aa6b1603ebcedbddbe',
    MyOutfitsRefetchQuery = '10db4e349f3123c56df14e3adec2ee6f',
    MyOutfitCommonDataEquipmentsQuery = 'd29cd0c2b5e6bac90dd5b817914832f8',
    MyOutfitCommonDataFilteringConditionQuery = 'd02ab22c9dccc440076055c8baa0fa7a',
    PhotoAlbumQuery = '7e950e4f69a5f50013bba8a8fb6a3807',
    PhotoAlbumRefetchQuery = '53fb0ad32c13dd9a6e617b1158cc2d41',
    ReplayQuery = 'f98cc8326d0d17b07a5785096b0f3517',
    ReplayUploadedReplayListRefetchQuery = 'dd56e76c75cda6af077a223c351ad61d',
    SettingQuery = '61228d553e7463c203e05e7810dd79a7',
    StageRecordQuery = '53dffcfb06b273dd7bdf6a303d310730',
    StageRecordsRefetchQuery = '38624d4864879c745c7b20e653e062db',
    StageScheduleQuery = '10e1d424391e78d21670227550b3509f',
    WeaponRecordQuery = 'a0c277c719b758a926772879d8e53ef8',
    WeaponRecordsRefetchQuery = '23c9b2b4ad878c2d91a68859be928dea',
    CatalogQuery = 'aead379b98c14798df81f0dd3ebe6121',
    CatalogRefetchQuery = '02d2de8967f4ad2ce4f67a3c6c7c4d48',
    HomeQuery = 'dba47124d5ec3090c97ba17db5d2f4b3',
    VsHistoryDetailPagerRefetchQuery = '994cf141e55213e6923426caf37a1934',
    VsHistoryDetailQuery = 'cd82f2ade8aca7687947c5f3210805a6',
}
