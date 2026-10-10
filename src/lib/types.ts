export type Role = 'user' | 'admin'

export interface User {
  _id: string
  name: string
  username: string
  email: string | null
  role: Role
  status: 'active' | 'disabled'
  emailVerified: boolean
  lastLoginAt: string | null
  createdAt: string
}

export type ProgramStatus = 'Live' | 'Recent' | 'Closed'

export interface Program {
  _id: string
  title: string
  organizer?: string
  type?: string
  category: string
  venue?: string
  about?: string
  registrationLink?: string
  contact?: string
  imageurls: string[]
  tags: string[]
  status: ProgramStatus
  deadline?: string
  eventDate?: string
  createdAt: string
}

export interface ProgramList {
  results: number
  total: number
  page: number
  pages: number
  data: { programs: Program[] }
}

export interface ChatMessage {
  _id: string
  body: string
  senderRole: Role
  createdAt: string
}

export interface Post {
  _id: string
  body: string
  author: Pick<User, '_id' | 'name' | 'username'>
  likes: number
  likedByMe: boolean
  mine: boolean
  hidden: boolean
  createdAt: string
  updatedAt: string
}

export interface PostList {
  results: number
  total: number
  page: number
  pages: number
  data: { posts: Post[] }
}

export interface Conversation {
  _id: string
  user: Pick<User, '_id' | 'name' | 'username' | 'email'>
  status: 'open' | 'closed'
  lastMessage: string
  lastMessageAt: string
  unreadForAdmin: number
  unreadForUser: number
}
