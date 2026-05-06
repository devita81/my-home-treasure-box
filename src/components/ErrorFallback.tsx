import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorFallbackProps {
  resetError: () => void;
}

export const ErrorFallback = ({ resetError }: ErrorFallbackProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <AlertTriangle className="h-16 w-16 text-destructive" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Algo deu errado</h1>
          <p className="text-muted-foreground">
            Ocorreu um erro inesperado. Já fomos notificados — pode tentar de novo
            ou voltar para o início.
          </p>
        </div>
        <div className="flex gap-2 justify-center flex-wrap">
          <Button onClick={resetError}>Tentar de novo</Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Voltar para o início
          </Button>
        </div>
      </div>
    </div>
  );
};
