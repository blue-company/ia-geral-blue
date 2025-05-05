"use client"

import { useEffect, useState } from "react"
import { Loader2, Server, RefreshCw, AlertCircle } from "lucide-react"
import { checkApiHealth } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function MaintenancePage() {
  const [isCheckingHealth, setIsCheckingHealth] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const checkHealth = async () => {
    setIsCheckingHealth(true)
    try {
      await checkApiHealth()
      // If we get here, the API is healthy
      window.location.reload()
    } catch (error) {
      console.error('API health check failed:', error)
    } finally {
      setIsCheckingHealth(false)
      setLastChecked(new Date())
    }
  }

  useEffect(() => {
    checkHealth()
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <Server className="h-16 w-16 text-primary animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
              </div>
            </div>
          </div>
          
          <h1 className="text-3xl font-bold tracking-tight">
            Manutenção do Sistema
          </h1>
          
          <p className="text-muted-foreground">
            Estamos realizando manutenção em nossos sistemas. Nossa equipe está trabalhando para restaurar tudo o mais rápido possível.
          </p>

          <Alert className="mt-6">
            <AlertTitle>Execuções de Agentes Interrompidas</AlertTitle>
            <AlertDescription>
              Todas as execuções de agentes em andamento foram interrompidas durante a manutenção. Você precisará reiniciá-las manualmente quando o sistema voltar ao normal.
            </AlertDescription>
          </Alert>
        </div>

        <div className="space-y-4">
          <Button
            onClick={checkHealth}
            disabled={isCheckingHealth}
            className="w-full"
          >
            <RefreshCw className={cn(
              "mr-2 h-4 w-4",
              isCheckingHealth && "animate-spin"
            )} />
            {isCheckingHealth ? "Verificando..." : "Verificar Novamente"}
          </Button>

          {lastChecked && (
            <p className="text-sm text-muted-foreground">
              Última verificação: {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
} 