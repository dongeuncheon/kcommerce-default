import React from 'react'
import { Check } from 'lucide-react'

interface CheckoutStepsProps {
  currentStep: number
}

const steps = [
  { number: 1, label: 'Shipping' },
  { number: 2, label: 'Payment' },
  { number: 3, label: 'Review' },
  { number: 4, label: 'Complete' },
]

export const CheckoutSteps: React.FC<CheckoutStepsProps> = ({ currentStep }) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <div className="flex items-center">
              <div
                className={`
                  flex h-10 w-10 items-center justify-center rounded-full
                  ${
                    step.number < currentStep
                      ? 'bg-primary-600 text-white'
                      : step.number === currentStep
                      ? 'border-2 border-primary-600 bg-primary-600 text-white'
                      : 'border-2 border-gray-300 bg-white text-gray-500'
                  }
                `}
              >
                {step.number < currentStep ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`
                  ml-2 text-sm font-medium
                  ${
                    step.number <= currentStep
                      ? 'text-primary-600'
                      : 'text-gray-500'
                  }
                `}
              >
                {step.label}
              </span>
            </div>
            
            {index < steps.length - 1 && (
              <div
                className={`
                  flex-1 mx-4 h-0.5
                  ${
                    step.number < currentStep
                      ? 'bg-primary-600'
                      : 'bg-gray-300'
                  }
                `}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}