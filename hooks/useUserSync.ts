import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useAppDispatch } from '@/lib/redux/hooks'
import { setUser, clearUser } from '@/lib/redux/slices/userSlice'
import { useGetUserQuery } from '@/lib/redux/api/userApi'

export function useUserSync() {
  const { data: session, status } = useSession()
  const dispatch = useAppDispatch()
  
  // Fetch user data when session is available
  const { data: userData, isLoading, error } = useGetUserQuery(undefined, {
    skip: status !== 'authenticated' || !session?.user?.id,
  })

  useEffect(() => {
    if (status === 'authenticated' && userData) {
      // Update Redux with fetched user data
      dispatch(setUser({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        image: userData.image,
        phoneNumber: userData.phoneNumber,
        countryCode: userData.countryCode,
        bio: userData.bio,
      }))
    } else if (status === 'unauthenticated') {
      // Clear Redux state on logout
      dispatch(clearUser())
    }
  }, [status, userData, dispatch])

  return {
    isLoading: status === 'loading' || isLoading,
    isAuthenticated: status === 'authenticated',
    error,
  }
}

