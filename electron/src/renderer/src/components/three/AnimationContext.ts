import { createContext, useContext } from 'react'

export const AnimTimeContext = createContext<React.RefObject<number>>({ current: 0 })
export const useAnimTimeRef = () => useContext(AnimTimeContext)
