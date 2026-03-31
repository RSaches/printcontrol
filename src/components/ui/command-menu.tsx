import { useEffect, useState } from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./command"
import { Pause, Trash, FileText, Settings } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  // const { update } = useSettingsStore()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Digite um comando (Ctrl+K)..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        
        <CommandGroup heading="Ações Rápidas">
          <CommandItem onSelect={() => runCommand(() => { toast.info("Monitoramento pausado (Simulado)") })}>
            <Pause className="mr-2 h-4 w-4" />
            <span>Pausar Monitoramento</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => { navigate("/reports"); toast.success("Módulo de relatório aberto") })}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Área de Relatórios</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => { toast.success("Fila limpa (Simulado)") })}>
            <Trash className="mr-2 h-4 w-4 text-destructive" />
            <span className="text-destructive">Limpar Spooler</span>
          </CommandItem>
        </CommandGroup>
        
        <CommandSeparator />
        
        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Ver Histórico Recente</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Configurações</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
