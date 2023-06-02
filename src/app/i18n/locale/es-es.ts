import { CREDITS_NOTICE, LICENCE_NOTICE } from '../../../common/constants.js';

export const app = {
    default_title: 'Nintendo Switch Online',

    licence: LICENCE_NOTICE,
    credits: CREDITS_NOTICE,
    translation_credits: 'Traducido al {{language}} por {{authors, list}}.',
};

export const app_menu = {
    preferences: 'Preferencias',
    view: 'Ver',
    learn_more: 'Más Información',
    learn_more_github: 'Más Información (GitHub)',
    search_issues: 'Buscar Incidendias',

    refresh: 'Actualizar',
};

export const menu_app = {
    coral_heading: 'Nintendo Switch Online',
    na_id: 'Nintendo Account ID: {{id}}',
    coral_id: 'Coral ID: {{id}}',
    nsa_id: 'NSA ID: {{id}}',
    discord_presence_enable: 'Activar Discord Rich Presence',
    user_notifications_enable: 'Activar notificaciones para este usuario',
    friend_notifications_enable: 'Activar notificaciones para amigos de este usuario',
    refresh: 'Actualizar ahora',
    add_friend: 'Añadir amigo',
    web_services: 'Servicios web',

    moon_heading: 'Control parental de Nintendo Switch',

    add_account: 'Añadir cuenta',

    show_main_window: 'Mostrar la ventana principal',
    preferences: 'Preferencias',
    quit: 'Cerrar',
};

export const menus = {
    add_account: {
        add_account_coral: 'Añadir cuenta de Nintendo Switch Online',
        add_account_moon: 'Añadir cuenta de Control parental de Nintendo Switch',
    },

    friend_code: {
        share: 'Compartir',
        copy: 'Copiar',
        friend_code_regenerable: 'Regenerar usando una consola Nintendo Switch',
        friend_code_regenerable_at: 'Se puede regenerar el {{date, datetime}}',
    },

    user: {
        na_id: 'Nintendo Account ID: {{id}}',
        coral_id: 'Coral ID: {{id}}',
        nsa_id: 'NSA ID: {{id}}',
        discord_disable: 'Desactivar Discord Rich Presence',
        discord_enabled_for: 'Discord Rich Presence activado para {{name}}',
        discord_enabled_via: 'Discord Rich Presence activado usando {{name}}',
        discord_enable: 'Activar Discord Rich Presence para este usuario...',
        friend_notifications_enable: 'Activar notificaciones para amigos',
        refresh: 'Actualizar ahora',
        add_friend: 'Añadir amigo',
        remove_help: 'Utiliza el comando nxapi para eliminar a este usuario',
    },

    friend: {
        presence_online: 'Online',
        game_first_played: 'Jugado por primera vez: {{date, datetime}}',

        game_play_time_h: 'Tiempo de juego: $t(friend.hours, {"count": {{hours}}})',
        game_play_time_hm: 'Tiempo de juego: $t(friend.hours, {"count": {{hours}}}), $t(friend.minutes, {"count": {{minutes}}})',
        game_play_time_m: 'Tiempo de juego: $t(friend.minutes, {"count": {{minutes}}})',
        hours_one: '{{count}} hora',
        hours_other: '{{count}} horas',
        minutes_one: '{{count}} minuto',
        minutes_other: '{{count}} minutos',

        presence_inactive: 'Desconectado (consola conectada)',
        presence_offline: 'Desconectado',
        presence_updated: 'Actualizado: {{date, datetime}}',
        presence_logout_time: 'Hora de desconexión: {{date, datetime}}',
        discord_presence_enable: 'Activar Discord Rich Presence',
    },
};

export const notifications = {
    playing: 'Jugando {{name}}',
    offline: 'Desconectado',
};

export const handle_uri = {
    friend_code_select: 'Selecciona un usuario para añadir amigos',
    web_service_select: 'Selecciona un usuario para abrir este servicio web',
    web_service_invalid_title: 'Servicio web inválido',
    web_service_invalid_detail: 'La URL no hace referencia a un servicio web existente.',
    cancel: 'Cancelar',
};

export const na_auth = {
    window: {
        title: 'Cuenta Nintendo',
    },

    znca_api_use: {
        title: 'Uso de API de terceros',

        text: `
        Para acceder a la API de la aplicación Nintendo Switch Online, nxapi debe enviar algunos datos a APIs de terceros. Esto es necesario para generar ciertos datos y hacer que Nintendo piense que estás utilizando la aplicación real de Nintendo Switch Online.
        
        Por defecto se utiliza nxapi-znca-api.fancy.org.uk o api.imink.app, pero se puede utilizar otro servicio mediante la configuración de una variable de entorno. La API predeterminada puede cambiar sin previo aviso si no se especifica un servicio específico.
        
        Los datos enviados incluyen:
        
        - La ID de tu cuenta Nintendo
        - Al autenticar a la aplicación Nintendo Switch Online: un token de la cuenta Nintendo que contiene tu país, válido durante 15 minutos
        - Al autenticar en servicios específicos de juegos: tu ID de usuario de Coral (aplicación Nintendo Switch Online) y un token ID de Coral que contiene tu estado de suscripción a Nintendo Switch Online y el estado de restricciones en tu cuenta, válido durante 2 horas
        `,

        ok: 'OK',
        cancel: 'Cancelar',
        more_information: 'Más Información',
    },

    notification_coral: {
        title: 'Nintendo Switch Online',
        body_existing: 'Ya has iniciado sesión como {{name}} (Nintendo Account {{na_name}} / {{na_username}})',
        body_authenticated: 'Autenticado como {{name}} (Nintendo Account {{na_name}} / {{na_username}})',
        body_reauthenticated: 'Reautenticado como {{name}} (Nintendo Account {{na_name}} / {{na_username}})',
    },

    notification_moon: {
        title: 'Control parental de Nintendo Switch',
        body_existing: 'Ya has iniciado sesión como {{na_name}} ({{na_username}})',
        body_authenticated: 'Autenticado como {{na_name}} ({{na_username}})',
        body_reauthenticated: 'Reautenticado como {{na_name}} ({{na_username}})',
    },

    error: {
        title: 'Error añadiendo cuenta',
    },
};

export const time_since = {
    default: {
        now: 'ahora',
        seconds_one: 'Hace {{count}} segundo',
        seconds_other: 'Hace {{count}} segundos',
        minutes_one: 'Hace {{count}} minuto',
        minutes_other: 'Hace {{count}} minutos',
        hours_one: 'Hace {{count}} hora',
        hours_other: 'Hace {{count}} horas',
        days_one: 'Hace {{count}} día',
        days_other: 'Hace {{count}} días',
    },

    short: {
        now: 'Ahora',
        seconds_one: '{{count}} seg',
        seconds_other: '{{count}} seg',
        minutes_one: '{{count}} min',
        minutes_other: '{{count}} min',
        hours_one: '{{count}} h',
        hours_other: '{{count}} h',
        days_one: '{{count}} día',
        days_other: '{{count}} días',
    },
};

export const main_window = {
    sidebar: {
        discord_active: 'Discord Rich Presence activo',
        discord_active_friend: 'Discord Rich Presence activo: <0></0>',
        discord_not_active: 'Discord Rich Presence no está activo',
        discord_playing: 'Jugando',
        discord_not_connected: 'No conecado a Discord',

        add_user: 'Añadir usuario',
        discord_setup: 'Configurar Discord Rich Presence',

        enable_auto_refresh: 'Activar actualización automática',
    },

    update: {
        update_available: 'Actualización disponible: {{name}}',
        download: 'Descargar',
        error: 'Error buscando actualizaciones: {{message}}',
        retry: 'Intentar de nuevo',
    },

    main_section: {
        error: {
            title: 'Error cargando datos',
            message: 'Se produjo un error cargando los datos {{errors, list}}.',
            message_friends: 'amigos',
            message_webservices: 'servicios específicos de juegos',
            message_event: 'chat de voz',
            retry: 'Reintentar',
            view_details: 'Ver detalles',
        },

        moon_only_user: {
            title: 'Nintendo Switch Online',
            desc_1: 'Este usuario ha iniciado sesión a la aplicación de Control parental de Nintendo Switch, pero no en la aplicación de Nintendo Switch Online.',
            desc_2: 'Inicia sesión en la aplicación de Nintendo Switch Online para ver los detalles aquí, o utiliza el comando nxapi para acceder a los datos de Control Parental.',
            login: 'Iniciar Sesión',
        },

        section_error: 'Error actualizando datos',
    },

    discord_section: {
        title: 'Discord Rich Presence',

        setup_with_existing_user: 'Utiliza una de estas cuentas para configurar Discord Rich Presence para este usuario: <0></0>.',
        add_user: 'Añade una cuenta de Nintendo Switch Online con este usuario como amigo para configurar Discord Rich Presence.',
        active_self: 'Compartiendo el estado de este usuario.',
        active_friend: 'El estado de <0></0> se está compartiendo a Discord usando esta cuenta.',
        active_unknown: 'El estado de un usuario desconocido se está compartiendo a Discord usando esta cuenta.',
        active_via: 'El estado de este usuario se está compartiendo a Discord usando <0></0>.',

        setup: 'Configurar',
        disable: 'Desactivar',
    },

    friends_section: {
        title: 'Amigos',
        add: 'Añadir',

        no_friends: 'Añade amigos usando una consola Nintendo Switch.',
        friend_code: 'Tu código de amigo: <0></0>',

        presence_playing: 'Jugando',
        presence_offline: 'Desconectado',
    },

    webservices_section: {
        title: 'Servicios específicos de juegos',
    },

    event_section: {
        title: 'Chat de voz',

        members: '{{event}} jugando, {{voip}} en chat de voz',
        members_with_total: '{{event}} jugando, {{voip}} en chat de voz de {{total}} miembros',

        app_start: 'Usa la aplicación de Nintendo Switch Online en iOS o Android para empezar un chat de voz.',
        app_join: 'Usa la aplicación de Nintendo Switch Online en iOS o Android para unirte un chat de voz.',

        share: 'Compartir',
    },
};

export const preferences_window = {
    title: 'Preferencias',

    startup: {
        heading: 'Inicio',
        login: 'Abrir al iniciar sesión',
        background: 'Abrir en segundo plano',
    },

    sleep: {
        heading: 'Sleep',
    },

    discord: {
        heading: 'Discord Rich Presence',
        enabled: 'Discord Rich Presence está activado.',
        disabled: 'Discord Rich Presence está desactivado.',
        setup: 'Configuración de Discord Rich Presence',

        user: 'Usuario de Discord',
        user_any: 'El primero que encuentre',

        friend_code: 'Código de amigo',
        friend_code_help: 'Añadir tu código de amigo también enseñará tu icono de usuario de Nintendo Switch en Discord.',
        friend_code_self: 'Compartir mi código de amigo',
        friend_code_custom: 'Personalizar código de amigo',

        inactive_presence: 'Mostrar inactividad',
        inactive_presence_help: 'Muestra "No está jugando" cuando una consola vinculada con tu cuenta está en línea, pero tú no estás jugando.',

        play_time: 'Tiempo de juego',
        play_time_hidden: 'Nunca mostrar el tiempo de juego',
        play_time_nintendo: 'Mostrar el tiempo de juego como aparece en la consola Nintendo Switch',
        play_time_approximate_play_time: 'Mostrar tiempo de juego aproximado (5 horas más cercanas)',
        play_time_approximate_play_time_since: 'Mostrar tiempo de juego aproximado (5 horas más cercanas) con fecha de la primera partida',
        play_time_hour_play_time: 'Mostrar tiempo de juego aproximado (hora más cercana)',
        play_time_hour_play_time_since: 'Mostrar tiempo de juego aproximado (hora más cercana) con fecha de la primera partida',
        play_time_detailed_play_time: 'Mostrar tiempo de juego exacto',
        play_time_detailed_play_time_since: 'Mostrar tiempo de juego exacto con fecha de la primera partida',
    },

    splatnet3: {
        heading: 'SplatNet 3',
        discord: 'Activar Discord Rich Presence ampliado para Splatoon 3',
        discord_help_1: 'Utiliza SplatNet 3 para mostrar información adicional mientras juegas Splatoon 3. Deberás usar una cuenta Nintendo secundaria que esté añadida como amigo en tu cuenta principal y tenga acceso a SplatNet 3.',
        discord_help_2: 'Si utilizas una URL que devuelva datos de Splatoon 3 se mostrará la información adicional sin tener en cuenta esta opción.',
    },
};

export const friend_window = {
    no_presence: 'No tienes acceso al estado de este usuario, o nunca se ha conectado.',

    nsa_id: 'NSA ID',
    coral_id: 'Coral user ID',
    no_coral_user: 'Nunca ha usado la aplicación de Nintendo Switch Online',

    friends_since: 'Amigos desde: {{date, datetime}}',
    presence_updated_at: 'Estado actualizado: {{date, datetime}}',
    presence_logout_at: 'Última vez online: {{date, datetime}}',

    presence_sharing: 'Este usuario puede ver tu estado.',
    presence_not_sharing: 'Este usuario no puede ver tu estado.',

    discord_presence: 'Compartir estado\nen Discord',
    close: 'Cerrar',

    presence_playing: 'Jugando {{game}}',
    presence_offline: 'Desconectado',
    presence_last_seen: 'Visto por última vez: {{since_logout}}',

    game_played_for_h: 'Jugado durante: $t(hours, {"count": {{hours}}})',
    game_played_for_hm: 'Jugado durante: $t(hours, {"count": {{hours}}}), $t(minutes, {"count": {{minutes}}})',
    game_played_for_m: 'Jugado durante: $t(minutes, {"count": {{minutes}}})',
    hours_one: '{{count}} hora',
    hours_other: '{{count}} horas',
    minutes_one: '{{count}} minuto',
    minutes_other: '{{count}} minutos',

    game_first_played: 'Jugado por primera vez: {{date, datetime}}',
    game_first_played_now: 'Jugado por primera vez: ahora',
    game_title_id: 'Title ID',
    game_shop: 'Nintendo eShop',
};

export const addfriend_window = {
    title: 'Añadir amigo',
    help: 'Escribe o pega un código de amigo o una URL de código de amigo para enviar una solicitud de amistad.',

    lookup_error: 'Se produjo un error al buscar el código de amigo: {{message}}',

    nsa_id: 'NSA ID',
    coral_id: 'Coral user ID',
    no_coral_user: 'Nunca ha utilizado la aplicación de Nintendo Switch Online',

    send_added: 'Ahora eres amigo de este usuario.',
    send_sent: 'Solicitud de amistad enviada. {{user}} puede aceptar tu solicitud de amistad usando una consola Nintendo Switch, o enviándote una solicitud de amistad usando la aplicación de Nintendo Switch Online o nxapi.',
    send_sending: 'Enviando solicitud de amistad...',
    send_error: 'Se produjo un error al enviar la solicitud de amistad: {{message}}',

    already_friends: 'Ya eres amigo de este usuario.',

    close: 'Cerrar',
    send: 'Enviar solicitud de amistad',
};

export const discordsetup_window = {
    title: 'Configuración de Discord Rich Presence',

    mode_heading: '1. Selecciona un modo',
    mode_coral_friend: 'Selecciona un usuario que sea amigo del usuario que quieres compartir',
    mode_url: 'Introduce una URL que devuelva el estado que quieres compartir',
    mode_none: 'Desactivar',

    coral_user_heading: '2. Selecciona un usuario',
    coral_user_help: 'Este usuario tiene que ser amigo del usuario que quieres compartir.',
    coral_friend_heading: '3. Selecciona un amigo',
    coral_friend_help: 'Este es el usuario que quieres compartir.',

    url_heading: '2. Ingresa una URL de estado',
    url_help: 'Esta URL tiene que usar HTTPS y devolver un objeto JSON con una clave de usuario, amigo o estado. Esta función está diseñada para ser usada con el proxy de la API znc de nxapi.',

    preferences_heading: 'Configura opciones adicionales para Discord Rich Presence',
    preferences: 'Preferencias',

    cancel: 'Cancelar',
    save: 'Guardar',
};

export const addaccountmanual_window = {
    title: 'Añadir cuenta',

    authorise_heading: '1. Inicia sesión en tu cuenta Nintendo',
    authorise_help: 'Aún no elijas una cuenta.',
    authorise_open: 'Abrir la autorización de la cuenta Nintendo',

    response_heading: '2. Introduce el enlace de callback',
    response_help_1: 'En la pagina de "Vincular una cuenta externa", dale click derecho a "Elegir a esta persona" y copia el link. El link debería de empezar con "{{url}}".',
    response_help_2: 'Si deseas agregar una cuenta infantil vinculada a tu cuenta, haz clic en "Elegir a esta persona". Si solo se muestra la cuenta infantil, haz clic derecho en "Elegir esta persona" y copia el enlace.',

    cancel: 'Cancelar',
    save: 'Añadir cuenta',
};
