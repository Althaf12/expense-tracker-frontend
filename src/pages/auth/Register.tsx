import Grid from '@mui/material/Grid'
import { Typography } from '@mui/material'
import { useState, type FormEvent, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StatusMessage } from '../../types/app'
import { friendlyErrorMessage } from '../../utils/format'
import styles from './Register.module.css'
import { registerUser } from '../../api'

type StatusSetter = (status: StatusMessage | null) => void

type RegisterProps = {
  setStatus: StatusSetter
}

export default function Register({ setStatus }: RegisterProps): ReactElement {
  const [username, setUsername] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const navigate = useNavigate()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)
    setLoading(true)

    try {
      await registerUser({ username, email, password })
      setStatus({ type: 'success', message: 'Registration successful — you can now log in.' })
      navigate('/')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'registering') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Grid container component="section" className={styles.page} direction="column" spacing={0}>
      <Grid size={12} className={styles.card}>
        <Typography variant="h4" component="h1" className={styles.title}>
          Register
        </Typography>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-username">
              Username
            </label>
            <input
              id="register-username"
              className={styles.input}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-email">
              Email
            </label>
            <input
              id="register-email"
              className={styles.input}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-password">
              Password
            </label>
            <input
              id="register-password"
              className={styles.input}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={loading}>
              {loading ? 'Registering...' : 'Register'}
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => navigate('/') }>
              Back to Login
            </button>
          </div>
        </form>
      </Grid>
    </Grid>
  )
}
