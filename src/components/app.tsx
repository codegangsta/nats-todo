import { createId } from "@paralleldrive/cuid2";
import { JSONCodec, connect, jwtAuthenticator, type KV } from "nats.ws";
import { For, onMount } from "solid-js";
import { createStore } from "solid-js/store";

interface Task {
  id: string;
  name: string;
  done: boolean;
}

interface TaskStore {
  tasks: Record<string, Task | undefined>;
}

const jwt =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJlZDI1NTE5LW5rZXkifQ.eyJqdGkiOiJETFhPWjVSTDNIWUdTMzJSVjQ3QUFTVlBDUDQ3MkdOSEM2RkpHWFFXTFAyTkU0QUY1RkJBIiwiaWF0IjoxNzE1Mjc0MzU0LCJpc3MiOiJBQVcyWk9FUlpTWUNQNk5GTVREUFlPN0ZERTY2VE5DS0ZQRE9GWlBaVUc1S1dMWjVTNU01Q1NPUSIsIm5hbWUiOiJ0b2RvIiwic3ViIjoiVUFIU1pVTTdHWjZQQVJBNEpHQzNHTDUySDVMV0lPU0JMQkpVUk00Sk9CSVZPTEZFNE1GWVdFQUIiLCJuYXRzIjp7InB1YiI6e30sInN1YiI6e30sInN1YnMiOi0xLCJkYXRhIjotMSwicGF5bG9hZCI6LTEsImJlYXJlcl90b2tlbiI6dHJ1ZSwiaXNzdWVyX2FjY291bnQiOiJBQTJMVU5GTkZYRkhGMzVTVlNHT0lKTENEWVdSWUFOSTM3WVBEVkVXV0lOR1RHUExRSElKRjI2TSIsInR5cGUiOiJ1c2VyIiwidmVyc2lvbiI6Mn19.7xzNOtBtgWyOrzpeMEJYG0YGQXthXpZwF67afcaPF8MmKPC5WNpWqoE5dplU0A7Zi1JgnavD1KCXey2nKG45AA";

export function App() {
  const [tasks, setTasks] = createStore<TaskStore>({
    tasks: {},
  });
  const nc = connect({
    servers: ["connect.ngs.global"],
    authenticator: jwtAuthenticator(jwt),
  });
  nc.catch(console.error);

  var tasksKV: KV;

  onMount(async () => {
    const conn = await nc;
    console.log("connected", conn);
    tasksKV = await conn.jetstream().views.kv("tasks");
    console.log("tasksKV", tasksKV);
    const watcher = await tasksKV.watch({
      key: ">",
    });
    for await (const entry of watcher) {
      console.log(entry.key, entry.operation);
      switch (entry.operation) {
        case "PUT":
          const jc = JSONCodec<Task>();
          const task = jc.decode(entry.value);
          setTasks("tasks", entry.key, task);
          break;
        case "DEL":
          setTasks("tasks", entry.key, undefined);
          break;
      }
    }
  });

  const addTask = async (task: Task) => {
    const jc = JSONCodec();
    await tasksKV.put(task.id, jc.encode(task));
  };

  const deleteTask = async (id: string) => {
    await tasksKV.delete(id);
  };

  const allTasks = () => {
    return Object.values(tasks.tasks).filter((t) => t !== undefined) as Task[];
  };

  return (
    <div class="flex flex-col gap-4">
      <span class="font-bold">Task List</span>
      <For each={allTasks()}>
        {(task) => (
          <div class="flex flex-row gap-2 items-center">
            <input
              type="checkbox"
              checked={task.done}
              onChange={(e) => {
                addTask({
                  ...task,
                  done: (e.target as HTMLInputElement).checked,
                });
              }}
            />
            <input
              onChange={(e) =>
                addTask({
                  ...task,
                  name: (e.target as HTMLInputElement).value,
                })
              }
              class="flex-grow bg-transparent"
              value={task.name}
            />
            <button onClick={() => deleteTask(task.id)} class="text-red-400">
              x
            </button>
          </div>
        )}
      </For>
      <button
        class="bg-white text-zinc-900 rounded"
        onClick={() => {
          addTask({
            id: createId(),
            name: "New Task",
            done: false,
          });
        }}
      >
        Add Task
      </button>
    </div>
  );
}
