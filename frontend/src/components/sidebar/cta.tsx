import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Briefcase, ExternalLink } from "lucide-react"
import { SubzeroProcessModal } from "@/components/sidebar/kortix-enterprise-modal"

export function CTACard() {
  return (
    <div className="flex flex-col space-y-2 py-2 px-1">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">Demonstração Empresarial</span>
        <span className="text-xs text-muted-foreground mt-0.5">Funcionários de IA para sua empresa</span>
      </div>
      <div className="flex flex-col space-y-2">
        <SubzeroProcessModal />
        {/* <Link href="https://cal.com/marko-kraemer/15min" target="_blank" rel="noopener noreferrer">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
          >
            Schedule Demo
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </Button>
        </Link> */}
      </div>
    </div>
  )
}
