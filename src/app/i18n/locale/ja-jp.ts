import { CREDITS_NOTICE, LICENCE_NOTICE } from '../../../common/constants.js';

export const app = {
    default_title: 'Nintendo Switch Online',

    licence: LICENCE_NOTICE,
    credits: CREDITS_NOTICE,
    translation_credits: 'Japanese translation by hilot06.',
};

export const app_menu = {
    preferences: '設定',
    view: '表示',
    learn_more: 'もっと知る',
    learn_more_github: 'GitHubでもっと知る',
    search_issues: 'Issuesの検索',

    refresh: '更新',
};

export const menu_app = {
    coral_heading: 'Nintendo Switch Online',
    na_id: 'ニンテンドーアカウントのID: {{id}}',
    coral_id: 'Coral ID: {{id}}',
    nsa_id: 'NSA ID: {{id}}',
    discord_presence_enable: 'Discord Presenceを有効にする',
    user_notifications_enable: 'このユーザーの通知を有効にする',
    friend_notifications_enable: 'フレンド通知を有効にする',
    refresh: '今すぐアップデート',
    add_friend: 'フレンドを追加',
    web_services: 'Webサービス',

    moon_heading: 'NintendoみまもりSwitch',

    add_account: 'アカウントを追加',

    show_main_window: 'メイン画面を表示',
    preferences: '設定',
    quit: '終了',
};

export const menus = {
    add_account: {
        add_account_coral: 'Nintendo Switch Online アカウントを追加',
        add_account_moon: 'NintendoみまもりSwitch アカウントを追加',
    },

    friend_code: {
        share: '共有',
        copy: 'コピー',
        friend_code_regenerable: 'Nintendo Switch本体を使ってフレンドコードを再発行',
        friend_code_regenerable_at: '{{date, datetime}}から再発行できます',
    },

    user: {
        na_id: 'ニンテンドーアカウントのID: {{id}}',
        coral_id: 'Coral ID: {{id}}',
        nsa_id: 'NSA ID: {{id}}',
        discord_disable: 'Discord Rich Presenceが無効',
        discord_enabled_for: '{{name}}のDiscord Rich Presenceが有効',
        discord_enabled_via: '{{name}}を経由したDiscord Rich Presenceが有効',
        discord_enable: 'このユーザーに対してDiscord Rich Presenceを有効化する...',
        friend_notifications_enable: 'フレンド通知を有効化',
        refresh: '今すぐアップデート',
        add_friend: 'フレンドを追加',
        remove_help: 'このユーザーを削除するには、nxapiコマンドを使用してください。',
    },

    friend: {
        presence_online: 'オンライン',
        game_first_played: '初めてあそんだ日: {{date, datetime}}',

        game_play_time_h: 'プレイ時間: $t(friend.hours, {"count": {{hours}}})',
        game_play_time_hm: 'プレイ時間: $t(friend.hours, {"count": {{hours}}}), $t(friend.minutes, {"count": {{minutes}}})',
        game_play_time_m: 'プレイ時間: $t(friend.minutes, {"count": {{minutes}}})',
        hours_one: '{{count}}時間',
        hours_other: '{{count}}時間',
        minutes_one: '{{count}}分',
        minutes_other: '{{count}}分',

        presence_inactive: 'オンライン (ゲーム未起動)',
        presence_offline: 'オフライン',
        presence_updated: '更新日時: {{date, datetime}}',
        presence_logout_time: 'オフラインになった日時: {{date, datetime}}',
        discord_presence_enable: 'Discord Rich Presenceを有効化',
    },
};

export const notifications = {
    playing: '{{name}} をプレイ中',
    offline: 'オフライン',
};

export const handle_uri = {
    friend_code_select: 'フレンドを追加するユーザーを選択',
    web_service_select: 'このWebサービスを開くユーザーを選択',
    web_service_invalid_title: '無効なWebサービス',
    web_service_invalid_detail: 'そのURLは既存のWebサービスを参照していません。',
    cancel: 'キャンセル',
};

export const time_since = {
    default: {
        now: 'たった今',
        seconds_one: '{{count}}秒前',
        seconds_other: '{{count}}秒前',
        minutes_one: '{{count}}分前',
        minutes_other: '{{count}}分前',
        hours_one: '{{count}}時間前',
        hours_other: '{{count}}時間前',
        days_one: '{{count}}日前',
        days_other: '{{count}}日前',
    },

    short: {
        now: '今',
        seconds_one: '{{count}}秒',
        seconds_other: '{{count}}秒',
        minutes_one: '{{count}}分',
        minutes_other: '{{count}}分',
        hours_one: '{{count}}時間',
        hours_other: '{{count}}時間',
        days_one: '{{count}}日',
        days_other: '{{count}}日',
    },
};

export const main_window = {
    sidebar: {
        discord_active: 'Discord Rich Presenceが動作中',
        discord_active_friend: 'Discord Rich Presenceが動作中: <0></0>',
        discord_not_active: 'Discord Rich Presenceは動作していません',
        discord_playing: 'プレイ中',

        add_user: 'ユーザーを追加',
        discord_setup: 'Discord Rich Presenceを設定',

        enable_auto_refresh: '自動更新',
    },

    update: {
        update_available: 'アップデートが利用可能: {{name}}',
        download: 'ダウンロード',
        error: 'アップデートの確認に失敗しました: {{message}}',
        retry: 'やり直す',
    },

    main_section: {
        error: {
            title: 'データ読み込みエラー',
            message: '{{errors, list}} データの読み込み中にエラーが発生しました。.',
            message_friends: 'フレンド',
            message_webservices: 'ゲーム固有サービス',
            message_event: 'ボイスチャット',
            retry: 'やり直す',
            view_details: '詳細を表示',
        },

        moon_only_user: {
            title: 'Nintendo Switch Online',
            desc_1: 'このユーザーはNintendo Switch Onlineのアプリではなく、NintendoみまもりSwitchのアプリにサインインしています。',
            desc_2: '詳細を確認するには、こちらからNintendo Switch Onlineのアプリにログインするか、nxapiのコマンドを使ってNintendoみまもりSwitchのデータを閲覧してください。',
            login: 'ログイン',
        },

        section_error: 'データ更新エラー',
    },

    discord_section: {
        title: 'Discord Rich Presence',

        setup_with_existing_user: 'この中からDiscord Rich Presenceの表示に使うアカウントを選択: <0></0>.',
        add_user: 'このユーザーのNintendo Switch Onlineアカウントをフレンドとして追加し、Discord Rich Presenceを設定します。',
        active_self: 'このユーザーの情報をDiscordで表示',
        active_friend: '<0></0>の情報をこのアカウントを使ってDiscordで表示',
        active_unknown: '不明なユーザーの情報が、このアカウントを使ってDiscordで表示されます。',
        active_via: 'このユーザーの情報は<0></0>を使ってDiscordで表示されます。',

        setup: 'セットアップ',
        disable: '無効化',
    },

    friends_section: {
        title: 'フレンド',
        add: '追加する',

        no_friends: 'Nintendo Switch本体を使ってフレンドを追加してください。',
        friend_code: 'あなたのフレンドコード: <0></0>',

        presence_playing: 'プレイ中',
        presence_offline: 'オフライン',
    },

    webservices_section: {
        title: 'ゲーム固有サービス',
    },

    event_section: {
        title: 'ボイスチャット',

        members: 'ゲーム: {{event}} 人 / ボイスチャット: {{voip}} 人',
        members_with_total: 'ゲーム: {{event}} 人 / ボイスチャット: {{voip}} 人 / 計 {{total}} 人',

        app_start: 'スマホのNintendo Switch Onlineアプリを使ってボイスチャットを開始してください。',
        app_join: 'スマホのNintendo Switch Onlineアプリを使ってボイスチャットに参加してください。',

        share: '共有する',
    },
};

export const preferences_window = {
    title: '設定',

    startup: {
        heading: 'スタートアップ',
        login: 'Windowsにログインした時に開く',
        background: 'バックグラウンドで開く',
    },

    sleep: {
        heading: 'スリープ',
    },

    discord: {
        heading: 'Discord Rich Presence',
        enabled: 'Discord Rich Presenceは有効です。',
        disabled: 'Discord Rich Presenceは無効です。',
        setup: 'Discord Rich Presenceのセットアップ',

        user: 'Discordユーザー',
        user_any: '最初に見つかったユーザーを使う',

        friend_code: 'フレンドコード',
        friend_code_help: 'フレンドコードを追加すると、DiscordにNintendo Switch上のユーザーアイコンも表示されます。',
        friend_code_self: 'フレンドコードを共有',
        friend_code_custom: 'カスタムフレンドコードを設定',

        inactive_presence: '本体を起動している時にプレゼンスを表示',
        inactive_presence_help: 'ゲームはしていないがNintendo Switch本体を起動している時、「Not playing」を表示します。',

        play_time: 'プレイ時間',
        play_time_hidden: 'プレイ時間を表示しない',
        play_time_nintendo: 'Nintendo Switch本体と同じようにプレイ時間を表示する',
        play_time_approximate_play_time: '5時間刻みのプレイ時間を表示',
        play_time_approximate_play_time_since: '5時間刻みのプレイ時間を初プレイの日時と一緒に表示',
        play_time_hour_play_time: '1時間刻みのプレイ時間を表示',
        play_time_hour_play_time_since: '1時間刻みのプレイ時間を初プレイの日時と一緒に表示',
        play_time_detailed_play_time: '正確なプレイ時間を表示',
        play_time_detailed_play_time_since: '正確なプレイ時間を初プレイの日時と一緒に表示',
    },

    splatnet3: {
        heading: 'イカリング3',
        discord: 'スプラトゥーン3向けのDiscord Rich Presenceを有効にする',
        discord_help_1: 'スプラトゥーン3をプレイ中に、イカリング3を使って追加の情報を取得・表示します。メインアカウントとフレンドであるサブアカウントを用意し、サブアカウントがイカリング3にアクセスできる必要があります。',
        discord_help_2: 'Discord Presenceに設定したURLからイカリング3のデータが返ってくる場合は、この設定に関係なく追加の情報が取得・表示されます。',
    },
};

export const friend_window = {
    no_presence: 'このユーザーのプレイ情報を表示する権限がないか、このユーザーがオンラインになったことがありません。',

    nsa_id: 'NSA ID',
    coral_id: 'CoralユーザーID',
    no_coral_user: 'Nintendo Switch Onlineアプリ未使用',

    friends_since: 'フレンドになった日: {{date, datetime}}',
    presence_updated_at: '状態の最終更新: {{date, datetime}}',
    presence_logout_at: '最終オンライン: {{date, datetime}}',

    presence_sharing: 'このユーザーはあなたのプレイ情報を見られます。',
    presence_not_sharing: 'このユーザーはあなたのプレイ情報を見られません。',

    discord_presence: 'Discordでプレイ情報をシェア',
    close: '閉じる',

    presence_playing: '{{game}}をプレイ中',
    presence_offline: 'オフライン',
    presence_last_seen: '最終ログイン: {{since_logout}}',

    game_played_for_h: '$t(hours, {"count": {{hours}}}) 経過',
    game_played_for_hm: '$t(hours, {"count": {{hours}}}), $t(minutes, {"count": {{minutes}}}) 経過',
    game_played_for_m: '$t(minutes, {"count": {{minutes}}}) 経過',
    hours_one: '{{count}}時間',
    hours_other: '{{count}}時間',
    minutes_one: '{{count}}分',
    minutes_other: '{{count}}分',

    game_first_played: '{{date, datetime}}にはじめてプレイ',
    game_first_played_now: '初プレイ中',
    game_title_id: 'ゲームID',
    game_shop: 'ニンテンドー eショップ',
};

export const addfriend_window = {
    title: 'フレンドを追加',
    help: 'フレンド申請を送るには、フレンドコードかフレンドコードURLを入力してください。',

    lookup_error: 'フレンドコードを見つけられません: {{message}}',

    nsa_id: 'NSA ID',
    coral_id: 'Coral user ID',
    no_coral_user: 'Nintendo Switch Onlineアプリ未使用',

    send_added: 'このユーザーはフレンドです。',
    send_sent: 'フレンド申請を送信しました。 {{user}}はNintendo Switchを使ってフレンド申請を許可するか、Nintendo Switch Onlineやnxapiを使ってフレンド申請を送れます。',
    send_sending: 'フレンド申請を送信中...',
    send_error: 'フレンド申請の送信に失敗しました: {{message}}',

    already_friends: 'すでにこのユーザーはフレンドです。',

    close: '閉じる',
    send: 'フレンド申請を送信',
};

export const discordsetup_window = {
    title: 'Discord Rich Presence 設定',

    mode_heading: '1. モードを選択',
    mode_coral_friend: 'フレンドのプレイ情報を共有する',
    mode_url: 'URLを入力して返ってくるデータを共有する',
    mode_none: '無効',

    coral_user_heading: '2. ユーザーを選択',
    coral_user_help: 'このユーザーは、プレイ情報を共有するユーザーとフレンド同士である必要があります。',
    coral_friend_heading: '3. フレンドを選択',
    coral_friend_help: 'このユーザーのプレイ情報を共有します。',

    url_heading: '2. プレイ情報URLを入力',
    url_help: 'このURLは、ユーザー・フレンド・プレゼンスキーのいずれかを含んだJSONファイルを返すHTTPSのURLでなければなりません。このオプションは、nxapiのznc APIプロキシを使うことを想定しています。',

    preferences_heading: 'Discord Rich Presenceの追加設定を表示',
    preferences: '設定',

    cancel: 'キャンセル',
    save: '保存する',
};

export const addaccountmanual_window = {
    title: 'アカウントを追加',

    authorise_heading: '1. ニンテンドーアカウントにログイン',
    authorise_help: 'まだアカウントを選択しないでください',
    authorise_open: 'ニンテンドーアカウントのログインページを開く',

    response_heading: '2. コールバックリンクを入力',
    response_help_1: '「アカウントを連携」ページに表示される「この人にする」を右クリックし、リンクをコピーしてください。コピーされたリンクは「{{url}}」から始まります。',
    response_help_2: 'おとなアカウントに紐づいているこどもアカウントを追加する場合は、こどもアカウントの「この人にする」を押してこどもアカウントにサインインしてから、こどもアカウントのみが表示された状態の「この人にする」ボタンのリンクをコピーしてください。',

    cancel: 'キャンセル',
    save: 'アカウントを追加',
};