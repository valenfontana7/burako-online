type LobbyState = {
  isConnecting?: boolean;
  error?: string | null;
};

type Props = {
  rawName: string;
  setRawName: (s: string) => void;
  handleCreateTable: () => Promise<void> | void;
  handleLeaveTable: () => Promise<void> | void;
  state: LobbyState;
  playerName: string;
  selectedTableId: string | null;
};

export default function PlayerPanel({
  rawName,
  setRawName,
  handleCreateTable,
  handleLeaveTable,
  state,
  playerName,
  selectedTableId,
}: Props) {
  return (
    <section className="panel" aria-labelledby="player-panel">
      <div className="panel__header" id="player-panel">
        <h2>Tu mesa</h2>
      </div>
      <form className="panel__form" onSubmit={(e) => e.preventDefault()}>
        <label className="panel__label" htmlFor="player-name">
          Nombre de jugador
        </label>
        <div className="panel__field-group">
          <input
            id="player-name"
            value={rawName}
            onChange={(event) => setRawName(event.target.value)}
            placeholder="Ingresa tu nombre"
            maxLength={32}
          />
          <button
            type="button"
            onClick={() =>
              setRawName(`Jugador-${Math.floor(Math.random() * 900 + 100)}`)
            }
          >
            Aleatorio
          </button>
        </div>
        <div className="panel__actions">
          <button
            type="button"
            onClick={handleCreateTable}
            disabled={state.isConnecting || playerName.length === 0}
          >
            Crear mesa
          </button>
          <button
            type="button"
            onClick={handleLeaveTable}
            disabled={!selectedTableId}
          >
            Rendirse
          </button>
        </div>
      </form>
      {state.error && <p className="panel__error">{state.error}</p>}
    </section>
  );
}
