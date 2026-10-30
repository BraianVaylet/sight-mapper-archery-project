// Spanish (es-AR, voseo) is the source of truth for the catalog shape: `en.ts` must match it.
// Placeholders are display values: the client converts canonical params (m, mm) to the archer's
// unit before interpolating (errors.md §2), so a placeholder is `{{maxDistance}}`, not `{{maxDistanceM}}`.

export const es = {
  common: {
    appName: 'Sight Mapper',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Borrar',
    archive: 'Archivar',
    unarchive: 'Desarchivar',
    restore: 'Restaurar',
    undo: 'Deshacer',
    retry: 'Reintentar',
    close: 'Cerrar',
    back: 'Volver',
    loading: 'Cargando…',
  },
  validation: {
    custom: 'Valor no válido.',
    invalid_type: 'Tipo de dato no válido.',
    invalid_format: 'Formato no válido.',
    invalid_value: 'Valor no permitido.',
    unrecognized_keys: 'Campos no reconocidos.',
    too_small: 'Debe ser como mínimo {{minimum}}.',
    too_big: 'Debe ser como máximo {{maximum}}.',
    equipment: {
      manufacturerOrModel: 'Ingresá el fabricante o el modelo.',
    },
    mark: {
      distancePrecision: 'La distancia admite hasta 3 decimales.',
    },
    preferences: {
      empty: 'Indicá al menos una preferencia.',
    },
    scale: {
      minLessThanMax: 'El máximo debe ser mayor que el mínimo.',
      resolutionTooLarge: 'La resolución no puede superar el recorrido de la escala.',
    },
    setup: {
      duplicateArrowSets: 'No repitas sets de flechas.',
    },
    sight: {
      fixedUnitSize: 'Esta unidad tiene un tamaño fijo.',
    },
  },
  errors: {
    core: {
      validation: 'Revisá los datos ingresados.',
      invalidId: 'El identificador no es válido.',
      unauthenticated: 'Tu sesión venció. Iniciá sesión de nuevo.',
      routeNotFound: 'No encontramos lo que buscás.',
      notFound: 'No existe o no tenés acceso.',
      idempotencyMismatch: 'Esta operación ya se envió con otros datos. Probá de nuevo.',
      idAlreadyExists: 'Ese elemento ya existe.',
      staleWrite: 'Alguien lo cambió antes. Cargamos la versión más reciente.',
      payloadTooLarge: 'Los datos enviados son demasiado grandes.',
      unsupportedMediaType: 'Formato de datos no admitido.',
      preconditionRequired:
        'Falta información para guardar de forma segura. Actualizá la app e intentá de nuevo.',
      rateLimited: 'Demasiados intentos. Probá de nuevo en {{retryAfterS}} s.',
      unexpected: 'Algo salió mal de nuestro lado. Probá de nuevo.',
      isolationViolation: 'Algo salió mal de nuestro lado. Probá de nuevo.',
      notReady: 'El servicio no está disponible por ahora. Probá en unos minutos.',
    },
    auth: {
      weakPassword: 'La contraseña debe tener al menos {{minLength}} caracteres.',
      invalidOrExpiredToken: 'El enlace no es válido o ya venció.',
      invalidUsername:
        'El usuario debe tener de 3 a 30 caracteres: minúsculas, números, punto o guion bajo.',
      invalidCredentials: 'Usuario o contraseña incorrectos.',
      emailNotVerified: 'Verificá tu email para iniciar sesión.',
      emailTaken: 'Ese email ya está registrado.',
      usernameTaken: 'Ese usuario ya está en uso.',
      oauthProvider: 'No pudimos conectar con {{provider}}. Probá de nuevo.',
    },
    account: {
      noDeletionRequest: 'No hay una baja pendiente.',
      deletionAlreadyRequested: 'Ya pediste la baja. Se concreta el {{purgeAt}}.',
      invalidQuickAccess: 'Ese set de flechas no pertenece al setup.',
    },
    bow: {
      unsupportedType: 'Por ahora solo se admiten arcos compuestos.',
    },
    equipment: {
      inUse: 'Está en uso en {{setups}} setups y {{marks}} marcas. Podés archivarlo.',
    },
    sight: {
      marksOutOfRange: '{{count}} marcas quedarían fuera de la escala ({{min}}–{{max}}).',
      scaleChangeNeedsStrategy: 'Elegí cómo tratar las {{marks}} marcas existentes.',
      fixedUnitSize: 'La escala en {{unit}} tiene un tamaño de unidad fijo.',
    },
    setup: {
      duplicateBowSight: 'Ya tenés un setup con ese arco y esa mira.',
      arrowSetHasMarks: 'Ese set de flechas tiene {{marks}} marcas en este setup.',
      restoreExpired: 'Pasaron más de 30 días: ya no se puede restaurar.',
      componentUnavailable: 'El arco, la mira o el set de flechas no está disponible.',
      noArrowSets: 'El setup necesita al menos un set de flechas.',
    },
    mark: {
      duplicateDistance: 'Ya tenés una marca a {{distance}}.',
      restoreExpired: 'Pasaron más de 30 días: ya no se puede deshacer.',
      outOfScale: 'La lectura está fuera de la escala de la mira ({{min}}–{{max}}).',
      arrowSetNotInSetup: 'Ese set de flechas no es de este setup.',
    },
    calc: {
      needMarksInterpolate: 'Necesitás al menos {{need}} marcas para calcular (tenés {{have}}).',
      needMarksExtrapolate: 'Fuera del rango medido hacen falta {{need}} marcas (tenés {{have}}).',
      needMarksDoctor: 'El Doctor necesita {{need}} marcas (tenés {{have}}).',
      beyondVertex: 'Más allá de {{maxDistance}} la curva se invierte: no podemos estimar.',
      outOfScale: 'Esta lectura queda fuera de la escala de tu mira ({{min}}–{{max}}).',
    },
    net: {
      offline: 'Sin conexión.',
      timeout: 'La conexión tardó demasiado. Probá de nuevo.',
      badResponse: 'Recibimos una respuesta inesperada del servidor.',
    },
  },
} as const;
