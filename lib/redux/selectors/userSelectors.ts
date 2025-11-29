import { RootState } from '../store'

export const selectUser = (state: RootState) => state.user

export const selectUserImage = (state: RootState): string | null => {
  return state.user.image
}

export const selectUserName = (state: RootState): string | null => {
  return state.user.name
}

export const selectUserEmail = (state: RootState): string | null => {
  return state.user.email
}

export const selectUserId = (state: RootState): string | null => {
  return state.user.id
}

export const selectUserPhoneNumber = (state: RootState): string | null => {
  return state.user.phoneNumber
}

export const selectUserCountryCode = (state: RootState): string | null => {
  return state.user.countryCode
}

export const selectUserBio = (state: RootState): string | null => {
  return state.user.bio
}

