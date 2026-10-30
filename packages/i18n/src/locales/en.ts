import type { Messages } from '../types.js';

export const en: Messages = {
  common: {
    appName: 'Sight Mapper',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    archive: 'Archive',
    unarchive: 'Unarchive',
    restore: 'Restore',
    undo: 'Undo',
    retry: 'Retry',
    close: 'Close',
    back: 'Back',
    loading: 'Loading…',
  },
  validation: {
    custom: 'Invalid value.',
    invalid_type: 'Invalid type.',
    invalid_format: 'Invalid format.',
    invalid_value: 'Value not allowed.',
    unrecognized_keys: 'Unrecognized fields.',
    too_small: 'Must be at least {{minimum}}.',
    too_big: 'Must be at most {{maximum}}.',
    equipment: {
      manufacturerOrModel: 'Enter the manufacturer or the model.',
    },
    mark: {
      distancePrecision: 'Distance allows up to 3 decimals.',
    },
    preferences: {
      empty: 'Specify at least one preference.',
    },
    scale: {
      minLessThanMax: 'The maximum must be greater than the minimum.',
      resolutionTooLarge: "Resolution can't exceed the scale's range.",
    },
    setup: {
      duplicateArrowSets: "Don't repeat arrow sets.",
    },
    sight: {
      fixedUnitSize: 'This unit has a fixed size.',
    },
  },
  errors: {
    core: {
      validation: 'Please check the data you entered.',
      invalidId: 'The identifier is not valid.',
      unauthenticated: 'Your session expired. Please sign in again.',
      routeNotFound: "We couldn't find what you're looking for.",
      notFound: "It doesn't exist or you don't have access to it.",
      idempotencyMismatch: 'This request was already sent with different data. Try again.',
      idAlreadyExists: 'That item already exists.',
      staleWrite: "It was changed elsewhere. We've loaded the latest version.",
      payloadTooLarge: 'The data you sent is too large.',
      unsupportedMediaType: 'Unsupported data format.',
      preconditionRequired: 'Missing information to save safely. Update the app and try again.',
      rateLimited: 'Too many attempts. Try again in {{retryAfterS}} s.',
      unexpected: 'Something went wrong on our side. Please try again.',
      isolationViolation: 'Something went wrong on our side. Please try again.',
      notReady: 'The service is unavailable right now. Try again in a few minutes.',
    },
    auth: {
      weakPassword: 'Password must be at least {{minLength}} characters.',
      invalidOrExpiredToken: 'The link is invalid or has expired.',
      invalidUsername:
        'Username must be 3–30 characters: lowercase letters, numbers, dots or underscores.',
      invalidCredentials: 'Incorrect username or password.',
      emailNotVerified: 'Verify your email to sign in.',
      emailTaken: 'That email is already registered.',
      usernameTaken: 'That username is taken.',
      oauthProvider: "We couldn't connect to {{provider}}. Try again.",
    },
    account: {
      noDeletionRequest: 'There is no pending account deletion.',
      deletionAlreadyRequested: 'You already requested deletion. It will complete on {{purgeAt}}.',
      invalidQuickAccess: "That arrow set doesn't belong to the setup.",
    },
    bow: {
      unsupportedType: 'Only compound bows are supported for now.',
    },
    equipment: {
      inUse: "It's used in {{setups}} setups and {{marks}} marks. You can archive it instead.",
    },
    sight: {
      marksOutOfRange: '{{count}} marks would fall outside the scale ({{min}}–{{max}}).',
      scaleChangeNeedsStrategy: 'Choose how to handle the {{marks}} existing marks.',
      fixedUnitSize: 'A scale in {{unit}} has a fixed unit size.',
    },
    setup: {
      duplicateBowSight: 'You already have a setup with that bow and sight.',
      arrowSetHasMarks: 'That arrow set has {{marks}} marks in this setup.',
      restoreExpired: 'More than 30 days have passed: it can no longer be restored.',
      componentUnavailable: "The bow, sight or arrow set isn't available.",
      noArrowSets: 'A setup needs at least one arrow set.',
    },
    mark: {
      duplicateDistance: 'You already have a mark at {{distance}}.',
      restoreExpired: 'More than 30 days have passed: it can no longer be undone.',
      outOfScale: "The reading is outside the sight's scale ({{min}}–{{max}}).",
      arrowSetNotInSetup: "That arrow set isn't part of this setup.",
    },
    calc: {
      needMarksInterpolate: 'You need at least {{need}} marks to calculate (you have {{have}}).',
      needMarksExtrapolate:
        'Outside the measured range you need {{need}} marks (you have {{have}}).',
      needMarksDoctor: 'The Doctor needs {{need}} marks (you have {{have}}).',
      beyondVertex: "Beyond {{maxDistance}} the curve reverses: we can't estimate.",
      outOfScale: "This reading falls outside your sight's scale ({{min}}–{{max}}).",
    },
    net: {
      offline: "You're offline.",
      timeout: 'The connection timed out. Try again.',
      badResponse: 'We got an unexpected response from the server.',
    },
  },
};
