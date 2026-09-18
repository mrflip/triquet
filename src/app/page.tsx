import { Container, Typography } from '@mui/material'
import { greet } from '../lib/greeting.ts'

export default function HomePage() {
  return (
    <Container sx={{ py: 8 }}>
      <Typography variant="h1" component="h1">
        {greet({ name: 'triquet' })}
      </Typography>
    </Container>
  )
}
