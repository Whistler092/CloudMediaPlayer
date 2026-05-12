import { useContext } from 'react'
import { FirebaseUserContext } from '../context/FirebaseUserContext'

export function useFirebaseUser() {
  return useContext(FirebaseUserContext)
}
