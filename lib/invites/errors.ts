export class InviteInvalidError extends Error {
  constructor() {
    super('invite code not found or deactivated')
    this.name = 'InviteInvalidError'
  }
}

export class InviteExpiredError extends Error {
  constructor() {
    super('invite code expired')
    this.name = 'InviteExpiredError'
  }
}

export class InviteExhaustedError extends Error {
  constructor() {
    super('invite code has no uses left')
    this.name = 'InviteExhaustedError'
  }
}
