import { useLocalStorage, writeStorage } from '@rehooks/local-storage'
import { LobbyAPI, Server } from 'boardgame.io'
import { LobbyClient } from 'boardgame.io/client'
import { SocketIO } from 'boardgame.io/multiplayer'
import { Client } from 'boardgame.io/react'
import firebase from 'firebase/app'
import React, { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useDocumentData } from 'react-firebase-hooks/firestore'
import PusoyDosBoard from './Board'
import Button from './Button'
import { GAME_ID, NUM_PLAYERS, PusoyDos } from './Game'
import styles from './Lobby.module.css'

export default function Lobby() {
  const matchID = window.location.pathname.replace(/\//g, '')
  const lobbyClient = useMemo(
    () => new LobbyClient({ server: process.env.REACT_APP_LOBBY_SERVER }),
    []
  )
  const [playerName, setPlayerName] = useState<string>('')

  if (matchID) {
    return <MatchLobby matchID={matchID} lobbyClient={lobbyClient} />
  }

  function handleNameChange(e: ChangeEvent<HTMLInputElement>) {
    setPlayerName(e.target.value.trim())
  }

  async function handleCreate() {
    if (playerName.length < 1) {
      return
    }
    const { matchID } = await lobbyClient.createMatch(GAME_ID, {
      numPlayers: NUM_PLAYERS,
    })
    const { playerCredentials } = await lobbyClient.joinMatch(
      GAME_ID,
      matchID,
      {
        playerID: '0',
        playerName,
      }
    )
    writeStorage(matchID, {
      id: '0',
      name: playerName,
      credentials: playerCredentials,
    })
    await firebase.firestore().collection('matches').doc(matchID).set({
      players: [],
    })
    window.location.href = `/${matchID}`
  }

  return (
    <div className={styles.lobby}>
      <div className="dialog">
        <h1>DOS</h1>
        <p>Play Pusoy Dos online. That's it.</p>
        <div className={styles.inputCombo}>
          <input
            type="text"
            onChange={handleNameChange}
            placeholder="Your name"
          />
          <Button onClick={handleCreate}>Create a Game</Button>
        </div>
      </div>
    </div>
  )
}

type MatchLobbyProps = {
  matchID: string
  lobbyClient: LobbyClient
}

function MatchLobby({ matchID, lobbyClient }: MatchLobbyProps) {
  const matchRef = firebase.firestore().doc(`matches/${matchID}`)
  const [match] = useDocumentData<LobbyAPI.Match>(matchRef)
  const [player, setPlayer] = useLocalStorage<Record<string, string>>(matchID, {
    id: '',
    name: '',
    credentials: '',
  })

  function updateMatch() {
    lobbyClient.getMatch(GAME_ID, matchID).then((match) => {
      matchRef.set(match)
    })
  }

  useEffect(updateMatch, [])

  useEffect(() => {
    if (match?.nextMatchID) {
      window.location.href = `/${match.nextMatchID}`
    }
  }, [match])

  if (!match) {
    return null
  }

  function handleNameChange(e: ChangeEvent<HTMLInputElement>) {
    setPlayer({ ...player, name: e.target.value.trim() })
  }

  async function handleJoin() {
    if (player.name === '') {
      return
    }
    for (const { id, name } of match?.players || []) {
      if (!name) {
        const { playerCredentials } = await lobbyClient.joinMatch(
          GAME_ID,
          matchID,
          {
            playerID: `${id}`,
            playerName: player.name,
          }
        )
        setPlayer({
          ...player,
          id: `${id}`,
          credentials: playerCredentials,
        })
        updateMatch()
        break
      }
    }
  }

  if (match.players.every((player) => player.name)) {
    return (
      <Game
        matchID={matchID}
        playerID={player.id}
        credentials={player.credentials}
      />
    )
  }

  return (
    <div className={styles.lobby}>
      <div className="dialog">
        <h1>DOS</h1>
        <MatchPlayers players={match.players} />
        {player.credentials.length > 0 ? (
          <p>Waiting for more players&hellip;</p>
        ) : (
          <div className={styles.inputCombo}>
            <input
              type="text"
              onChange={handleNameChange}
              value={player.name}
              placeholder="Your name"
            />
            <Button onClick={handleJoin}>Join Game</Button>
          </div>
        )}
      </div>
    </div>
  )
}

const Game = Client({
  game: PusoyDos,
  numPlayers: NUM_PLAYERS,
  board: PusoyDosBoard,
  multiplayer: SocketIO({ server: process.env.REACT_APP_GAME_SERVER }),
  debug: false,
})

type MatchPlayersProps = {
  players: Server.PlayerMetadata[]
}

function MatchPlayers({ players }: MatchPlayersProps) {
  return (
    <div className={styles.matchPlayers}>
      <h2>Players</h2>
      {players
        .filter((player) => player.name)
        .map((player) => (
          <div className={styles.matchPlayer}>{player.name}</div>
        ))}
    </div>
  )
}
