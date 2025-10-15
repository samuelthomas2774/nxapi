import { CREDITS_NOTICE, LICENCE_NOTICE, ZNCA_API_USE_TEXT } from '../../../common/constants.js';

export const app = {
    default_title: 'Nintendo Switch App',

    licence: LICENCE_NOTICE,
    credits: CREDITS_NOTICE,
    translation_credits: '{{language}}由 {{authors, list}} 翻译。',
};

export const app_menu = {
    preferences: '选项',
    view: '视图',
    learn_more: '了解更多',
    learn_more_github: '了解更多（GitHub）',
    search_issues: '搜索 GitHub 议题',
    export_logs: '导出日志',

    refresh: '刷新',
};

export const menu_app = {
    coral_heading: 'Nintendo Switch App',
    na_id: 'Nintendo Account ID: {{id}}',
    coral_id: 'Coral ID: {{id}}',
    nsa_id: 'NSA ID: {{id}}',
    discord_presence_enable: '启用 Discord Rich Presence',
    user_notifications_enable: '启用该账号的在线状态通知',
    friend_notifications_enable: '启用该账号好友的在线状态通知',
    refresh: '立即刷新',
    add_friend: '添加好友',
    web_services: '游戏关联服务',

    moon_heading: '家长监护 Switch',

    add_account: '添加账号',

    show_main_window: '显示主窗口',
    preferences: '选项',
    quit: '退出',
};

export const menus = {
    add_account: {
        add_account_coral: '添加 Nintendo Switch App 账号',
        add_account_moon: '添加家长监护 Switch 账号',
    },

    friend_code: {
        share: '分享',
        copy: '复制',
        friend_code_regenerable: '用 Nintendo Switch 重新生成',
        friend_code_regenerable_at: '能在 {{date, datetime}} 生成',
    },

    user: {
        na_id: 'Nintendo Account ID: {{id}}',
        coral_id: 'Coral ID: {{id}}',
        nsa_id: 'NSA ID: {{id}}',
        discord_disable: '停用 Discord Rich Presence',
        discord_enabled_for: '为 {{name}} 启用 Discord Rich Presence',
        discord_enabled_via: '通过 {{name}} 启用 Discord Rich Presence',
        discord_enable: '设置 Discord Rich Presence 并启用...',
        friend_notifications_enable: '启用好友通知',
        refresh: '刷新',
        add_friend: '添加好友',
        remove_help: '用 nxapi 命令移除该账号',
    },

    friend: {
        presence_online: '在线',
        presence_online_nx: '在线（Nintendo Switch）',
        presence_online_ounce: '在线（Nintendo Switch 2）',
        game_first_played: '首次游玩：{{date, datetime}}',

        game_play_time_h: '游玩时长：$t(friend.hours, {"count": {{hours}}})',
        game_play_time_hm: '游玩时长：$t(friend.hours, {"count": {{hours}}}) $t(friend.minutes, {"count": {{minutes}}})',
        game_play_time_m: '游玩时长：$t(friend.minutes, {"count": {{minutes}}})',
        hours_one: '{{count}} 小时',
        hours_other: '{{count}} 小时',
        minutes_one: '{{count}} 分钟',
        minutes_other: '{{count}} 分钟',

        presence_inactive: '离线（主机在线）',
        presence_offline: '离线',
        presence_updated: '更新时间：{{date, datetime}}',
        presence_logout_time: '登出时间：{{date, datetime}}',
        discord_presence_enable: '启用 Discord Rich Presence',
    },
};

export const notifications = {
    playing: '正在游玩{{name}}',
    offline: '离线',
};

export const handle_uri = {
    friend_code_select: '选择一个账号添加好友',
    web_service_select: '选择一个账号打开游戏关联服务',
    web_service_invalid_title: '无效的游戏关联服务',
    web_service_invalid_detail: '该 URL 对应的游戏关联服务不存在。',
    cancel: '取消',
};

export const na_auth = {
    window: {
        title: 'Nintendo Account',
    },

    znca_api_use: {
        title: '第三方 API 使用说明',

        // This should be translated in other languages
        text: ZNCA_API_USE_TEXT,

        ok: '确定',
        cancel: '取消',
        more_information: '更多信息',
    },

    notification_coral: {
        title: 'Nintendo Switch App',
        body_existing: '已经以 {{name}}（Nintendo Account {{na_name}} / {{na_username}}）身份登录',
        body_authenticated: '以 {{name}}（Nintendo Account {{na_name}} / {{na_username}}）身份验证通过',
        body_reauthenticated: '重新以 {{name}}（Nintendo Account {{na_name}} / {{na_username}}）身份验证',
    },

    notification_moon: {
        title: '家长监护 Switch',
        body_existing: '已经以 {{na_name}}（{{na_username}}）身份登录',
        body_authenticated: '以 {{na_name}}（{{na_username}}）身份验证通过',
        body_reauthenticated: '重新以 {{na_name}}（{{na_username}}）身份验证',
    },

    error: {
        title: '添加账号出错',
    },
};

export const time_since = {
    default: {
        now: '刚刚',
        seconds_one: '{{count}} 秒前',
        seconds_other: '{{count}} 秒前',
        minutes_one: '{{count}} 分钟前',
        minutes_other: '{{count}} 分钟前',
        hours_one: '{{count}} 小时前',
        hours_other: '{{count}} 小时前',
        days_one: '{{count}} 天前',
        days_other: '{{count}} 天前',
    },

    short: {
        now: '刚刚',
        seconds_one: '{{count}} 秒',
        seconds_other: '{{count}} 秒',
        minutes_one: '{{count}} 分钟',
        minutes_other: '{{count}} 分钟',
        hours_one: '{{count}} 小时',
        hours_other: '{{count}} 小时',
        days_one: '{{count}} 天',
        days_other: '{{count}} 天',
    },
};

export const main_window = {
    sidebar: {
        discord_active: 'Discord Rich Presence 启用',
        discord_active_friend: 'Discord Rich Presence 启用：<0></0>',
        discord_not_active: 'Discord Rich Presence 未启用',
        discord_playing: '正在游玩中',
        discord_not_connected: '未连接到 Discord',

        add_user: '添加账号',
        discord_setup: '设置 Discord Rich Presence',
    },

    update: {
        update_available: '可更新：{{name}}',
        download: '下载',
        error: '查找更新出错：{{message}}',
        retry: '重试',
    },

    main_section: {
        error: {
            title: '加载出错',
            message: '加载{{errors, list}}时出现错误。',
            message_friends: '好友列表',
            message_webservices: '游戏关联服务',
            message_event: '语音聊天',
            retry: '重试',
            view_details: '查看详情',
        },

        moon_only_user: {
            title: 'Nintendo Switch App',
            desc_1: '当前账号已登录至家长监护 Switch，而不是 Nintendo Switch App。',
            desc_2: '登录至 Nintendo Switch App 以查看详情，或用 nxapi 命令查看家长监护 Switch 数据。',
            login: '登录',
        },

        section_error: '更新数据出错',
    },

    discord_section: {
        title: 'Discord Rich Presence',

        setup_with_existing_user: '用这些账号中的一个来设置该账号的 Discord Rich Presence：<0></0>.',
        add_user: '通过添加一个 Nintendo Account ，并与当前帐号成为好友来设置 Discord Rich Presence。',
        active_self: '当前账号的在线状态已被分享至 Discord。',
        active_friend: '<0></0> 的在线状态已通过该账号被分享至 Discord。',
        active_unknown: '未知账号的在线状态已通过该账号被分享至 Discord。',
        active_via: '当前账号的在线状态已通过 <0></0> 分享至 Discord。',

        setup: '设置',
        disable: '停用',
    },

    friends_section: {
        title: '好友',
        add: '添加',

        no_friends: '通过 Nintendo Switch 添加好友.',
        friend_code: '你的好友编号：<0></0>',

        presence_playing: '正在游玩',
        presence_offline: '离线',
    },

    webservices_section: {
        title: '游戏关联服务',
    },

    event_section: {
        title: '语音聊天',

        members: '游戏：{{event}} 人 / 语音聊天：{{voip}} 人',
        members_with_total: '游戏：{{event}} 人 / 语音聊天：{{voip}} 人 / 共 {{total}} 人',

        app_start: '用 iOS 或安卓的 Nintendo Switch App 开始语音聊天。',
        app_join: '用 iOS 或安卓的 Nintendo Switch App 加入语音聊天。',

        share: '分享',
    },
};

export const preferences_window = {
    title: '选项',

    startup: {
        heading: '启动',
        login: '开机后启动',
        background: '在后台启动',
    },

    sleep: {
        heading: '睡眠',
    },

    discord: {
        heading: 'Discord Rich Presence',
        enabled: 'Discord Rich Presence 已启用',
        disabled: 'Discord Rich Presence 已停用',
        setup: '设置 Discord Rich Presence',

        user: 'Discord 账号',
        user_any: '首次发现',

        friend_code: '好友编号',
        friend_code_help: '添加你的好友编号会同时在 Discord 显示你的 Nintendo Account 头像。',
        friend_code_self: '分享我的好友编号',
        friend_code_custom: '设置自定义好友编号',

        inactive_presence: '显示“Not Playing”状态',
        inactive_presence_help: '当与账号关联的主机开机，但没有启动任何游戏时，显示 “Not Playing”。',

        play_time: '游玩时长',
        play_time_hidden: '不显示游玩时长',
        play_time_nintendo: '跟随 Nintendo Switch 主机上的显示方式',
        play_time_approximate_play_time: '显示大致游玩时长（nearest 5 hours）',
        play_time_approximate_play_time_since: '同时显示大致游玩时长（nearest 5 hours）和首次游玩日期',
        play_time_hour_play_time: '显示大致游玩时长（nearest hour）',
        play_time_hour_play_time_since: '同时显示大致游玩时长（nearest hour）和首次游玩日期',
        play_time_detailed_play_time: '显示准确游玩时长',
        play_time_detailed_play_time_since: '同时显示准确游玩时长和首次游玩日期',
    },

    splatnet3: {
        heading: '鱿鱼圈 3',
        discord: '为斯普拉遁 3 启用“加强版” Discord Rich Presence',
        discord_help_1: '游玩斯普拉遁 3 时，通过鱿鱼圈 3 获取额外的在线状态信息（例如对战模式、场地）。你需要登录另一个能访问鱿鱼圈 3 的 Nintendo Account，并成为好友，才能获取额外的在线状态信息。',
        discord_help_2: '当使用能返回包含斯普拉遁 3 数据的在线状态 URL 时，额外的在线状态信息将会被直接显示（即该选项将被忽略）。',
    },

    miscellaneous: {
        heading: '其他',
        show_error_alerts: '显示错误提醒',
        show_error_alerts_help: '当在线状态更新发生错误时，弹出错误提醒。如果该选项未被选中，则 nxapi 会在发生错误时推迟在线状态更新。',
    },
};

export const friend_window = {
    no_presence: '你无权访问该账号的在线状态，或该账号从未在线。',

    nsa_id: 'NSA ID',
    coral_id: 'Coral user ID',
    no_coral_user: '从未使用 Nintendo Switch App',

    friends_since: '成为好友时间：{{date, datetime}}',
    presence_updated_at: '在线状态更新时间：{{date, datetime}}',
    presence_logout_at: '最后在线时间：{{date, datetime}}',

    presence_sharing: '该账号能看见你的在线状态。',
    presence_not_sharing: '该账号不能看见你的在线状态。',

    discord_presence: '分享在线状态至 Discord',
    close: '关闭',

    presence_playing: '正在游玩 {{game}}',
    presence_playing_nx: '正在游玩 {{game}}（Nintendo Switch）',
    presence_playing_ounce: '正在游玩 {{game}}（Nintendo Switch 2）',
    presence_offline: '离线',
    presence_last_seen: '距离上次在线：{{since_logout}}',

    game_played_for_h: '游玩 $t(hours, {"count": {{hours}}})以上',
    game_played_for_hm: '游玩 $t(hours, {"count": {{hours}}}), $t(minutes, {"count": {{minutes}}})以上',
    game_played_for_m: '游玩 $t(minutes, {"count": {{minutes}}})以上',
    hours_one: '{{count}} 小时',
    hours_other: '{{count}} 小时',
    minutes_one: '{{count}} 分钟',
    minutes_other: '{{count}} 分钟',

    game_first_played: '首次游玩时间：{{date, datetime}}',
    game_first_played_now: '首次游玩中',
    game_title_id: 'Title ID',
    game_shop: 'Nintendo eShop',
};

export const addfriend_window = {
    title: '添加好友',
    help: '输入好友编号或好友编号 URL 以发送好友申请',

    lookup_error: '查找好友编号出错：{{message}}',

    nsa_id: 'NSA ID',
    coral_id: 'Coral user ID',
    no_coral_user: '从未使用 Nintendo Switch App',

    send_added: '好友添加成功。',
    send_sent: '好友申请发送成功。',
    send_sending: '正在发送好友申请...',
    send_error: '发送好友申请时出错: {{message}}',

    already_friends: '已是你的好友。',

    close: '关闭',
    send: '发送好友申请',
};

export const discordsetup_window = {
    title: 'Discord Rich Presence 设置',

    mode_heading: '1、模式选择',
    mode_coral_friend: '“主次号”模式',
    mode_url: '输入 URL 模式',
    mode_none: '停用',

    coral_user_heading: '2、“次号”选择',
    coral_user_help: '该账号必须要与“主号”是好友关系，同时能看到“主号”的在线状态。',
    coral_friend_heading: '3. “主号”选择',
    coral_friend_help: '你想分享在线状态的账号。',

    url_heading: '2、URL 输入',
    url_help: '必须是一个能返回含有账号、好友或者在线状态 Key 的 JSON 对象的 HTTPS URL（通常用 nxapi znc API 代理生成）。',

    preferences_heading: '为 Discord Rich Presence 配置额外选项',
    preferences: '选项',

    cancel: '取消',
    save: '保存',
};

export const addaccountmanual_window = {
    title: '添加账号',

    authorise_heading: '1、登录你的 Nintendo Account',
    authorise_help: '不要直接点击“選擇此人”。',
    authorise_open: '打开 Nintendo Account 授权页',

    response_heading: '2、输入回调链接',
    response_help_1: '在“選擇連動帳號”页面，右键点击“選擇此人”并复制链接。该链接一般以“{{url}}”开头。',
    response_help_2: '如果要添加相关联的儿童账号，点击儿童账号旁边的“選擇此人”登录儿童账号，然后在页面仅显示儿童账号的状态下，右键点击“選擇此人”并复制链接。',

    cancel: '取消',
    save: '添加账号',
};
